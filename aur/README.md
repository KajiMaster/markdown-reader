# AUR packaging

`PKGBUILD` here builds `md-read-bin`, an Arch package that installs the prebuilt
binary from a GitHub release (no local Rust/Node toolchain needed).

## Publishing a new version

1. Cut a GitHub release by pushing a tag (`git tag v0.2.0 && git push origin v0.2.0`) —
   `.github/workflows/release.yml` builds it and attaches `md-read-<version>-x86_64.tar.gz`.
2. Bump `pkgver` in `PKGBUILD` to match, reset `pkgrel=1`.
3. Run `updpkgsums` in this directory to fill in the real `sha256sums`.
4. Test locally: `makepkg -si`.
5. Push to the AUR (requires an AUR account and the `ssh://aur@aur.archlinux.org/md-read-bin.git`
   remote — see the [AUR submission guidelines](https://wiki.archlinux.org/title/AUR_submission_guidelines)).
   This step has to be done by a human with AUR credentials; it isn't automated.
