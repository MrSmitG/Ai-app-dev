#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            let _ = std::process::Command::new("node")
                .args([
                    "../packages/engine/src/index.js",
                ])
                .current_dir(std::env::current_dir().unwrap_or_default())
                .spawn();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Localmod");
}
