./verify.sh exits 0 (tests, build, cargo check all PASS).
Fix: remark-stringify defaulted to `*` bullets; fixture/tests expect `-`. Added
`{ bullet: "-" }` option to the stringify processor in src/md.ts.
main.ts / lib.rs (argv, read_file, write_file, Crepe editor, save/save-as) were
already implemented from prior iterations and needed no changes.
