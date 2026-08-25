//! Local BM25 + overlap hybrid retrieval. Node engine implements ingest today.

pub fn hybrid_score(bm25: f32, overlap: f32) -> f32 {
    bm25 * 0.7 + overlap * 0.3
}
