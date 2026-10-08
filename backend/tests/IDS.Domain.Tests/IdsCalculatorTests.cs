using IDS.Domain.Calculations;

namespace IDS.Domain.Tests;

public sealed class IdsCalculatorTests
{
    [Fact]
    public void CalculatesWeightedScoreAndSharesWithoutRounding()
    {
        var observations = new[]
        {
            new ObservationInput(2m, 0.3m),
            new ObservationInput(1m, 1m),
            new ObservationInput(1m, 3m)
        };

        var result = IdsCalculator.Calculate(observations, 2m);

        Assert.Equal(2m, result.LowSeverityCount);
        Assert.Equal(1m, result.MediumSeverityCount);
        Assert.Equal(1m, result.HighSeverityCount);
        Assert.Equal(4m, result.TotalDeviations);
        Assert.Equal(4.6m, result.WeightedDeviationTotal);
        Assert.Equal(-1.3m, result.Score);
        Assert.Equal(0.5m, result.LowSeverityShare);
        Assert.Equal(0.25m, result.MediumSeverityShare);
        Assert.Equal(0.25m, result.HighSeverityShare);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void ReturnsNoScoreWhenObservedPeopleIsNotPositive(decimal observedPeople)
    {
        var result = IdsCalculator.Calculate(
            [new ObservationInput(1m, 1m)],
            observedPeople);

        Assert.Null(result.Score);
    }

    [Fact]
    public void CountsOnlyWeightsUsedByTheWorkbookSumIfFormulas()
    {
        var observations = new[]
        {
            new ObservationInput(4m, null),
            new ObservationInput(2m, 2m)
        };

        var result = IdsCalculator.Calculate(observations, 3m);

        Assert.Equal(0m, result.TotalDeviations);
        Assert.Equal(1m, result.Score);
        Assert.Null(result.LowSeverityShare);
        Assert.Null(result.MediumSeverityShare);
        Assert.Null(result.HighSeverityShare);
    }

    [Fact]
    public void FlagsAnIncompleteQuantityAndSeverityPair()
    {
        Assert.True(new ObservationInput(1m, null).HasIncompleteQuantitySeverityPair);
        Assert.True(new ObservationInput(null, 1m).HasIncompleteQuantitySeverityPair);
        Assert.False(new ObservationInput(null, null).HasIncompleteQuantitySeverityPair);
        Assert.False(new ObservationInput(1m, 1m).HasIncompleteQuantitySeverityPair);
    }
}