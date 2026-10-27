// Keep canonical formatters, but give them a regular-file stdin with a definite
// EOF. Node 26 synchronous input pipes can leave rustfmt waiting for EOF on the
// larger market-host projection. This changes transport only, never the source.
import {mkdtempSync,writeFileSync,openSync,closeSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

export function formatSourceFile(command,args,input) {
  const directory=mkdtempSync(path.join(tmpdir(),'yijie-canonical-format-'));
  const source=path.join(directory,'source');
  let fd;
  try {
    writeFileSync(source,input);
    fd=openSync(source,'r');
    return execFileSync(command,args,{stdio:[fd,'pipe','pipe'],maxBuffer:16*1024*1024});
  } finally {
    if(fd!==undefined)closeSync(fd);
    rmSync(directory,{recursive:true,force:true});
  }
}
