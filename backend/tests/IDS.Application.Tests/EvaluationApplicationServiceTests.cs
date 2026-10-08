using IDS.Application.Evaluations;
using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Tests;

public sealed class EvaluationApplicationServiceTests
{
    private static readonly Guid CategoryId = Guid.NewGuid();
    private static readonly Guid ItemId = Guid.NewGuid();
    private static readonly Guid LowSeverityId = Guid.NewGuid();

    [Fact]
    public async Task CreatesDraftAndReturnsWorkbookBasedIndicators()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);

        var result = await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, "Observação")
        ]), CancellationToken.None);

        Assert.Equal("Draft", result.Status);
        Assert.Equal(2m, result.Indicators.TotalDeviations);
        Assert.Equal(0.6m, result.Indicators.WeightedDeviationTotal);
        Assert.Equal(0.7m, result.Indicators.Ids);
        Assert.False(result.Observations.Single().HasIncompletePair);
        Assert.Equal(result.Id, repository.SavedEvaluation?.Id);
    }

    [Fact]
    public async Task SavesIncompletePairAndReturnsWarningInsteadOfDroppingDraft()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);

        var result = await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, null, null)
        ]), CancellationToken.None);

        Assert.True(result.Observations.Single().HasIncompletePair);
        Assert.Equal(1m, result.Indicators.Ids);
        Assert.NotNull(repository.SavedEvaluation);
    }

    [Fact]
    public async Task RejectsUnknownChecklistItem()
    {
        var service = new EvaluationApplicationService(CreateRepository());
        var request = CreateRequest(
        [
            new EvaluationObservationRequest(Guid.NewGuid(), 1m, LowSeverityId, null)
        ]);

        var exception = await Assert.ThrowsAsync<EvaluationValidationException>(
            () => service.CreateDraftAsync(request, CancellationToken.None));

        Assert.Contains(exception.Errors, error => error.Contains("Item de checklist inexistente", StringComparison.Ordinal));
    }

    [Fact]
    public async Task RejectsDuplicateChecklistItemInOneEvaluation()
    {
        var service = new EvaluationApplicationService(CreateRepository());
        var request = CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 1m, LowSeverityId, null),
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, null)
        ]);

        await Assert.ThrowsAsync<EvaluationValidationException>(
            () => service.CreateDraftAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task ReturnsPeriodTotalsFromRepository()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);
        await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, null)
        ]), CancellationToken.None);

        var totals = await service.GetPeriodTotalsAsync(null, null, null, null, CancellationToken.None);

        Assert.Equal(1, totals.EvaluationCount);
        Assert.Equal(2m, totals.ObservedPeopleTotal);
        Assert.Equal(2m, totals.TotalDeviations);
        Assert.Equal(2m, totals.LowSeverityDeviations);
        Assert.Equal(0m, totals.MediumSeverityDeviations);
        Assert.Equal(0m, totals.HighSeverityDeviations);
        Assert.Null(totals.Ids);
        Assert.Equal(0.7m, totals.Trend.Single().Ids);
    }

    [Fact]
    public async Task ConsolidatesTotalsByDateCategoryAndItem()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);
        await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, null)
        ]), CancellationToken.None);

        var data = await service.GetDataConsolidationAsync(null, null, null, null, CancellationToken.None);

        Assert.Equal(1, data.EvaluationCount);
        Assert.Equal(2m, data.TotalDeviations);
        Assert.Equal(0.6m, data.WeightedDeviationTotal);
        Assert.Equal(2m, data.Categories.Single().Quantity);
        Assert.Equal("Item de teste", data.Items.Single().Name);
        Assert.Equal(new DateOnly(2026, 10, 6), data.Days.Single().Date);
        Assert.Contains("REGRA A VALIDAR", data.WeekGroupingStatus, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConsolidatesWorkbookDataByDateCategoryAndItem()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);
        await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, null)
        ]), CancellationToken.None);

        var data = await service.GetDataConsolidationAsync(null, null, null, null, CancellationToken.None);

        Assert.Equal(1, data.EvaluationCount);
        Assert.Equal(2m, data.TotalDeviations);
        Assert.Equal(0.6m, data.WeightedDeviationTotal);
        Assert.Equal(2m, data.Categories.Single().Quantity);
        Assert.Equal("Item de teste", data.Items.Single().Name);
        Assert.Equal(new DateOnly(2026, 10, 6), data.Days.Single().Date);
        Assert.Contains("REGRA A VALIDAR", data.WeekGroupingStatus, StringComparison.Ordinal);
    }

    [Fact]
    public async Task UpdatesDraftAndRecalculatesItsIndicators()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);
        var created = await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 1m, LowSeverityId, "Inicial")
        ]), CancellationToken.None);
        var originalObservationId = repository.SavedEvaluation!.Observations.Single().Id;

        var updated = await service.UpdateDraftAsync(created.Id, CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 2m, LowSeverityId, "Atualizado")
        ]), CancellationToken.None);

        Assert.NotNull(updated);
        Assert.Equal(2m, updated.Indicators.TotalDeviations);
        Assert.Equal(0.7m, updated.Indicators.Ids);
        Assert.Equal("Atualizado", updated.Observations.Single().Comment);
        Assert.Equal(originalObservationId, repository.SavedEvaluation!.Observations.Single().Id);
    }

    [Fact]
    public async Task SubmitsDraftAndMakesItReadOnlyForEditing()
    {
        var repository = CreateRepository();
        var service = new EvaluationApplicationService(repository);
        var created = await service.CreateDraftAsync(CreateRequest(
        [
            new EvaluationObservationRequest(ItemId, 1m, LowSeverityId, null)
        ]), CancellationToken.None);

        var submitted = await service.SubmitDraftAsync(created.Id, CancellationToken.None);

        Assert.NotNull(submitted);
        Assert.Equal("Submitted", submitted.Status);
        await Assert.ThrowsAsync<EvaluationValidationException>(
            () => service.UpdateDraftAsync(created.Id, CreateRequest([]), CancellationToken.None));
    }

    private static CreateEvaluationRequest CreateRequest(IReadOnlyCollection<EvaluationObservationRequest> observations) =>
        new(
            new DateOnly(2026, 10, 6),
            null,
            null,
            null,
            null,
            null,
            "Auditor líder",
            "Auditor",
            null,
            2m,
            null,
            null,
            observations);

    private static FakeEvaluationRepository CreateRepository()
    {
        var category = new ObservationCategory
        {
            Id = CategoryId,
            Code = "test",
            Name = "Categoria teste",
            SortOrder = 1
        };
        var item = new ChecklistItem
        {
            Id = ItemId,
            CategoryId = CategoryId,
            Category = category,
            Code = "test_item",
            Name = "Item de teste",
            SortOrder = 1
        };
        var severity = new SeverityLevel
        {
            Id = LowSeverityId,
            Name = "Baixo",
            Weight = 0.3m,
            SortOrder = 1
        };

        return new FakeEvaluationRepository(new EvaluationReferenceData(
            new Dictionary<Guid, ChecklistItem> { [item.Id] = item },
            new Dictionary<Guid, SeverityLevel> { [severity.Id] = severity },
            new Dictionary<Guid, Site>(),
            new Dictionary<Guid, Organization>()));
    }

    private sealed class FakeEvaluationRepository(EvaluationReferenceData referenceData) : IEvaluationRepository
    {
        public Evaluation? SavedEvaluation { get; private set; }

        public Task<EvaluationReferenceData> LoadReferenceDataAsync(
            CreateEvaluationRequest request,
            CancellationToken cancellationToken) => Task.FromResult(referenceData);

        public Task AddAsync(Evaluation evaluation, CancellationToken cancellationToken)
        {
            SavedEvaluation = evaluation;
            return Task.CompletedTask;
        }

        public Task<Evaluation?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(SavedEvaluation?.Id == id ? SavedEvaluation : null);

        public Task<Evaluation?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken) =>
            Task.FromResult(SavedEvaluation?.Id == id ? SavedEvaluation : null);

        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<IReadOnlyCollection<Evaluation>> GetManyAsync(
            DateOnly? from,
            DateOnly? to,
            Guid? siteId,
            Guid? contractorId,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyCollection<Evaluation>>(SavedEvaluation is null ? [] : [SavedEvaluation]);

        public Task<EvaluationPeriodTotals> GetPeriodTotalsAsync(
            DateOnly? from,
            DateOnly? to,
            Guid? siteId,
            Guid? contractorId,
            CancellationToken cancellationToken)
        {
            var evaluation = SavedEvaluation;
            var totalDeviations = evaluation?.Observations
                .Where(observation => observation.SeverityLevel?.Weight is 0.3m or 1m or 3m)
                .Sum(observation => observation.Quantity ?? 0m) ?? 0m;
            return Task.FromResult(new EvaluationPeriodTotals(
                evaluation is null ? 0 : 1,
                evaluation?.ObservedPeople,
                totalDeviations,
                totalDeviations,
                0m,
                0m));
        }

        public Task<IReadOnlyCollection<EvaluationTrendRecord>> GetTrendRecordsAsync(
            DateOnly? from,
            DateOnly? to,
            Guid? siteId,
            Guid? contractorId,
            CancellationToken cancellationToken)
        {
            if (SavedEvaluation is null)
            {
                return Task.FromResult<IReadOnlyCollection<EvaluationTrendRecord>>([]);
            }

            var record = new EvaluationTrendRecord(
                SavedEvaluation.Id,
                SavedEvaluation.EvaluationDate,
                SavedEvaluation.ObservedPeople,
                SavedEvaluation.Observations
                    .Select(observation => new ObservationInput(observation.Quantity, observation.SeverityLevel?.Weight))
                    .ToArray());
            return Task.FromResult<IReadOnlyCollection<EvaluationTrendRecord>>([record]);
        }

        public Task<IReadOnlyCollection<ConsolidationRecord>> GetConsolidationRecordsAsync(
            DateOnly? from,
            DateOnly? to,
            Guid? siteId,
            Guid? contractorId,
            CancellationToken cancellationToken)
        {
            if (SavedEvaluation is null)
            {
                return Task.FromResult<IReadOnlyCollection<ConsolidationRecord>>([]);
            }

            var record = new ConsolidationRecord(
                SavedEvaluation.Id,
                SavedEvaluation.EvaluationDate,
                SavedEvaluation.ObservedPeople,
                SavedEvaluation.Observations.Select(observation => new ConsolidationObservationRecord(
                    observation.ChecklistItem.Category.Code,
                    observation.ChecklistItem.Category.Name,
                    observation.ChecklistItem.Code,
                    observation.ChecklistItem.Name,
                    observation.Quantity,
                    observation.SeverityLevel?.Weight)).ToArray());
            return Task.FromResult<IReadOnlyCollection<ConsolidationRecord>>([record]);
        }

    }
}