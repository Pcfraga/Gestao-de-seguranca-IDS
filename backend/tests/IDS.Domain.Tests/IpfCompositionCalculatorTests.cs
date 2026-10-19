using IDS.Domain.Calculations;

namespace IDS.Domain.Tests;

public sealed class IpfCompositionCalculatorTests
{
    private static readonly Guid A = Guid.Empty;
    private static readonly Guid B = Guid.NewGuid();

    [Fact]
    public void WeightsSeventyThirtyUsingAllUnroundedScores()
    {
        var result = IpfCompositionCalculator.Calculate([
            new(A, 70m, [0.8m, 0.9m, null]), new(B, 30m, [0.6m])
        ]);
        Assert.Equal(0.775m, result.Value);
        var first = result.Areas.First();
        Assert.Equal(0.85m, first.Average);
        Assert.Equal(70m, first.EffectiveWeight);
        Assert.Equal(0.595m, first.Contribution);
        Assert.Equal(3, first.EvaluationCount);
        Assert.Equal(2, first.ScoredEvaluationCount);
    }

    [Fact]
    public void MissingMeanRenormalizesRemainingWeightToOneHundred()
    {
        var result = IpfCompositionCalculator.Calculate([new(A, 70m, [null]), new(B, 30m, [0.6m])]);
        Assert.Equal(0.6m, result.Value);
        Assert.Equal("no-average", result.Areas.First().Status);
        Assert.Null(result.Areas.First().Contribution);
        Assert.Equal(100m, result.Areas.Last().EffectiveWeight);
        Assert.Equal(0.6m, result.Areas.Last().Contribution);
    }

    [Fact]
    public void GenuineZeroParticipatesButZeroWeightDoesNot()
    {
        var result = IpfCompositionCalculator.Calculate([
            new(A, 70m, [0m]), new(B, 30m, [1m]), new(Guid.NewGuid(), 0m, [-5m])
        ]);
        Assert.Equal(0.3m, result.Value);
        Assert.Equal("included", result.Areas.First().Status);
        Assert.Equal(70m, result.Areas.First().EffectiveWeight);
        Assert.Equal(0m, result.Areas.First().Contribution);
        Assert.Equal("zero-weight", result.Areas.Last().Status);
        Assert.Null(result.Areas.Last().Contribution);
    }

    [Fact]
    public void NoParticipatingScoreProducesNull()
    {
        var result = IpfCompositionCalculator.Calculate([new(A, 100m, [null]), new(B, 0m, [1m])]);
        Assert.Null(result.Value);
        Assert.All(result.Areas, area => Assert.Equal(0m, area.EffectiveWeight));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    public void SupportsOneThroughFourAreas(int count)
    {
        var areas = Enumerable.Range(0, count).Select(index =>
            new IpfAreaInput(Guid.NewGuid(), index == 0 ? 100m - (count - 1) * 20m : 20m, [0.9m])).ToArray();
        Assert.Equal(0.9m, IpfCompositionCalculator.Calculate(areas).Value);
    }

    [Theory]
    [InlineData("0.12345", "0.1235")]
    [InlineData("-0.12345", "-0.1235")]
    public void RoundsFinalScoreAwayFromZeroAndAllowsNegativeValues(string raw, string expected)
    {
        var score = decimal.Parse(raw, System.Globalization.CultureInfo.InvariantCulture);
        var result = IpfCompositionCalculator.Calculate([new(A, 100m, [score])]);
        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), result.Value);
        Assert.Equal(score, result.Areas.Single().Average);
    }

    [Fact]
    public void DoesNotRoundMeansBeforeWeighting()
    {
        var result = IpfCompositionCalculator.Calculate([
            new(A, 70m, [0.123449m]), new(B, 30m, [0.123499m])
        ]);
        Assert.Equal(0.1235m, result.Value);
        Assert.Equal(0.123449m, result.Areas.First().Average);
    }

    [Fact]
    public void RejectsInvalidConfigurations()
    {
        IpfAreaInput[][] invalid = [
            [], [new(A, 99m, [])], [new(A, 101m, []), new(B, -1m, [])],
            [new(A, 50m, []), new(A, 50m, [])],
            Enumerable.Range(0, 5).Select(_ => new IpfAreaInput(Guid.NewGuid(), 20m, [])).ToArray()
        ];
        foreach (var areas in invalid)
            Assert.Throws<ArgumentException>(() => IpfCompositionCalculator.Calculate(areas));
    }
}
