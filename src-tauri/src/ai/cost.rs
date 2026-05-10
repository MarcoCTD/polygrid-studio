const EUR_PER_USD: f64 = 0.92;

pub fn estimate_cost_eur(
    provider: &str,
    model: &str,
    tokens_input: u32,
    tokens_output: u32,
) -> f64 {
    let (input_usd_per_million, output_usd_per_million) = match (provider, model) {
        ("claude", "claude-sonnet-4-20250514") => (3.00, 15.00),
        ("claude", "claude-haiku-4-5-20251001") => (0.80, 4.00),
        ("openai", "gpt-4o") => (2.50, 10.00),
        ("openai", "gpt-4o-mini") => (0.15, 0.60),
        ("gemini", _) => (0.15, 0.15),
        ("ollama", _) => (0.00, 0.00),
        _ => (0.00, 0.00),
    };

    let input_cost = tokens_input as f64 * input_usd_per_million / 1_000_000.0;
    let output_cost = tokens_output as f64 * output_usd_per_million / 1_000_000.0;
    (input_cost + output_cost) * EUR_PER_USD
}
