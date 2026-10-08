namespace IDS.Domain.Calculations;

public sealed record ObservationInput(decimal? Quantity, decimal? SeverityWeight)
{
    public bool HasIncompleteQuantitySeverityPair => Quantity.HasValue != SeverityWeight.HasValue;
}