//! Spawn and monitor llama-server (CUDA / Metal / Vulkan / CPU) with GPU-layer offload.

pub fn gpu_layers_hint(vram_mb: u32) -> u32 {
    if vram_mb >= 16000 { 99 } else if vram_mb >= 8000 { 40 } else if vram_mb >= 4000 { 20 } else { 0 }
}
