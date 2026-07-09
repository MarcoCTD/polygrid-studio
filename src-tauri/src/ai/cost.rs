const EUR_PER_USD: f64 = 0.92;

pub fn estimate_cost_eur(
    provider: &str,
    model: &str,
    tokens_input: u32,
    tokens_output: u32,
) -> f64 {
    // Preise in USD pro 1 Mio. Tokens (Stand Juli 2026); Eintraege ohne
    // offizielle Preisliste sind konservative Schaetzungen.
    let (input_usd_per_million, output_usd_per_million) = match (provider, model) {
        ("claude", "claude-sonnet-5") => (3.00, 15.00),
        ("claude", "claude-opus-4-8") => (5.00, 25.00),
        ("claude", m) if m.starts_with("claude-haiku-4-5") => (1.00, 5.00),
        ("claude", _) => (3.00, 15.00),
        ("openai", "gpt-4o") => (2.50, 10.00),
        ("openai", "gpt-4o-mini") => (0.15, 0.60),
        ("openai", m) if m.contains("mini") || m.contains("nano") => (0.25, 2.00),
        ("openai", _) => (2.50, 10.00),
        ("gemini", m) if m.contains("pro") => (2.50, 10.00),
        ("gemini", m) if m.contains("lite") => (0.10, 0.40),
        ("gemini", _) => (0.30, 2.50),
        ("ollama", _) => (0.00, 0.00),
        _ => (0.00, 0.00),
    };

    let input_cost = tokens_input as f64 * input_usd_per_million / 1_000_000.0;
    let output_cost = tokens_output as f64 * output_usd_per_million / 1_000_000.0;
    (input_cost + output_cost) * EUR_PER_USD
}
