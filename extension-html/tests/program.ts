import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A program of one file of the package, under its compiler options with `options` over them. */
export const compile = (file: string, options: ts.CompilerOptions = {}) => {
  const config = ts.getParsedCommandLineOfConfigFile(resolve(ROOT, 'tsconfig.json'), options, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  });

  if (!config) throw new Error('The package has no config.');

  const path = resolve(ROOT, file);
  const program = ts.createProgram({ rootNames: [path], options: config.options, configFileParsingDiagnostics: config.errors });
  const source = program.getSourceFile(path);

  if (!source) throw new Error(`${file} is not in its program.`);

  return { program, source };
};

export const diagnostics = (program: ts.Program) => ts.getPreEmitDiagnostics(program).map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n'));
