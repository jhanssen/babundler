const fs = require("fs");

const modules = [];

const basedir = process.cwd() + "/";
//let dir = basedir;
let dirs = [];
let funcno = 0;

function moreThanOneSlash(file) {
    const ls = file.lastIndexOf("/");
    const fs = file.indexOf("/");
    if (fs !== ls) {
        return ls;
    }
    if (file.startsWith("../")) {
        return 2;
    }
    return -1;
}

function currentDir() {
    return dirs[dirs.length - 1];
}

function bundleFile(file) {
    const absfile = fs.realpathSync(currentDir() + file + ".js");

    for (const m of modules) {
        if (m.path === absfile) {
            return m.no;
        }
    }

    const rx = / = require\("(\.[^"]*)"/;

    const data = fs.readFileSync(absfile, "utf8");
    const no = ++funcno;

    const fixup = modules.length;
    const fixups = [];
    modules.push({ path: absfile, no: no });

    const lines = data.split("\n");
    for (const line of lines) {
        const m = line.match(rx);
        if (m) {
            // console.log("hm", m);

            let hasDir = false;
            const sl = moreThanOneSlash(m[1]);
            let fn = m[1];
            if (sl >= 0) {
                dirs.push(currentDir() + m[1].substring(0, sl) + "/");
                fn = "./" + m[1].substring(sl + 1);
                // console.log("updated dir", currentDir(), fn);
                hasDir = true;
            }

            fixups.push({ fn: fn, no: bundleFile(fn) });

            if (hasDir) {
                dirs.pop();
            }
        }
    }

    let fixcnt = 0;
    for (let lineno = 0; lineno < lines.length; ++lineno) {
        const m = lines[lineno].match(rx);
        if (m) {
            const no = fixups[fixcnt++].no;
            lines[lineno] = lines[lineno].substring(0, m.index) + ` = loadPlaygroundModule(${no});`;
        }
    }

    modules[fixup].data = `function(exports) {\n${lines.join("\n")}\n}`;

    return no;
}

function generate(file) {
    let str = "(function() {\n";
    str += "const modules = [];\n";
    str += "const moduleCache = [];\n";
    str += "function cachePlaygroundModule(no) { const exp = {}; moduleCache[no] = exp; modules[no](exp); return exp; };\n";
    str += "function loadPlaygroundModule(no) { if (moduleCache[no] === undefined) { return cachePlaygroundModule(no); } return moduleCache[no]; };\n";
    for (let m of modules) {
        str += "modules.push(" + m.data + ");\n";
    }
    str += "const module0Data = {};\n";
    str += "moduleCache[0] = module0Data;\n";
    str += "globalThis.module0Data = module0Data;\n";
    str += "modules[0](module0Data);\n";
    str += "})();\n";

    fs.writeFileSync(file, str, "utf8");
}

const args = process.argv.slice(2);
if (args.length > 0) {
    dirs.push(basedir);

    bundleFile(args[0]);
    //console.log(modules[0]);
    generate("out.js");
} else {
    console.error("no input file");
}
