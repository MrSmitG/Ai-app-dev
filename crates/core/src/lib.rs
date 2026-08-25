//! Localmod core: vault, airplane gate, hardware snapshot, integrity hashes.
//! The production control plane currently lives in `packages/engine` (Node sidecar).
//! These crates are the native path Tauri will call once Rust is installed.

pub fn airplane_allows_remote(airplane: bool) -> bool {
    !airplane
}
