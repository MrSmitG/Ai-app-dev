//! MCP client with explicit allow / always / deny.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Always,
    Deny,
}
