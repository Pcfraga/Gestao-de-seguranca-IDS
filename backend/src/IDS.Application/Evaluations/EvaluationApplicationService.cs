using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Evaluations;

public sealed class EvaluationApplicationService(IEvaluationRepository repository)
{
    public async Task<EvaluationDto> CreateDraftAsync(
        CreateEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        var duplicateItems = request.Observations
            .GroupBy(observation => observation.ChecklistItemId)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();
        if (duplicateItems.Length > 0)
        {
            throw new EvaluationValidationException(["Cada item pode aparecer apenas uma vez na avaliação."]);
        }

        var references = await repository.LoadReferenceDataAsync(request, cancellationToken);
        ValidateReferences(request, references);

        var evaluation = new Evaluation
        {
            Status = EvaluationStatus.Draft
        };

        ApplyRequest(evaluation, request, references);
        await repository.AddAsync(evaluation, cancellationToken);
        return ToDto(evaluation);
    }

    public async Task<EvaluationDto?> UpdateDraftAsync(
        Guid id,
        CreateEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        var evaluation = await repository.GetForUpdateAsync(id, cancellationToken);
        if (evaluation is null)
        {
            return null;
        }

        if (evaluation.Status != EvaluationStatus.Draft)
        {
            throw new EvaluationValidationException(["Somente avaliações em rascunho podem ser editadas."]);
        }

        ValidateNoDuplicateItems(request);
        var references = await repository.LoadReferenceDataAsync(request, cancellationToken);
        ValidateReferences(request, references);
        ApplyRequest(evaluation, request, references);
        await repository.SaveChangesAsync(cancellationToken);
        return ToDto(evaluation);
    }

    public async Task<EvaluationDto?> SubmitDraftAsync(Guid id, CancellationToken cancellationToken)
    {
        var evaluation = await repository.GetForUpdateAsync(id, cancellationToken);
        if (evaluation is null)
        {
            return null;
        }

        if (evaluation.Status != EvaluationStatus.Draft)
        {
            throw new EvaluationValidationException(["A avaliação não está mais em rascunho."]);
        }

        evaluation.Status = EvaluationStatus.Submitted;
        await repository.SaveChangesAsync(cancellationToken);
        return ToDto(evaluation);
    }

    public async Task<EvaluationDto?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var evaluation = await repository.GetByIdAsync(id, cancellationToken);
        return evaluation is null ? null : ToDto(evaluation);
    }

    public async Task<IReadOnlyCollection<EvaluationDto>> ListAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        if (from > to)
        {
            throw new EvaluationValidationException(["A data inicial deve ser anterior ou igual à data final."]);
        }

        var evaluations = await repository.GetManyAsync(from, to, siteId, contractorId, cancellationToken);
        return evaluations.Select(ToDto).ToArray();
    }

    public async Task<DashboardSummaryDto> GetPeriodTotalsAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        if (from > to)
        {
            throw new EvaluationValidationException(["A data inicial deve ser anterior ou igual à data final."]);
        }

        var totals = await repository.GetPeriodTotalsAsync(from, to, siteId, contractorId, cancellationToken);
        var trendRecords = await repository.GetTrendRecordsAsync(from, to, siteId, contractorId, cancellationToken);
        var trend = trendRecords.Select(record => new DashboardTrendPointDto(
            record.Id,
            record.EvaluationDate,
            IdsCalculator.Calculate(record.Observations, record.ObservedPeople ?? 0m).Score)).ToArray();
        return new DashboardSummaryDto(
            totals.EvaluationCount,
            totals.ObservedPeopleTotal,
            totals.TotalDeviations,
            totals.LowSeverityDeviations,
            totals.MediumSeverityDeviations,
            totals.HighSeverityDeviations,
            CalculateShare(totals.LowSeverityDeviations, totals.TotalDeviations),
            CalculateShare(totals.MediumSeverityDeviations, totals.TotalDeviations),
            CalculateShare(totals.HighSeverityDeviations, totals.TotalDeviations),
            null,
            "requires-calendar-rule-validation",
            trend);
    }

    public async Task<DataConsolidationDto> GetDataConsolidationAsync(
        DateOnly? from,
        DateOnly? to,
        Guid? siteId,
        Guid? contractorId,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(from, to);
        var records = await repository.GetConsolidationRecordsAsync(from, to, siteId, contractorId, cancellationToken);
        var observations = records.SelectMany(record => record.Observations).ToArray();
        var low = SumQuantityForWeight(observations, 0.3m);
        var medium = SumQuantityForWeight(observations, 1m);
        var high = SumQuantityForWeight(observations, 3m);
        var deviations = low + medium + high;

        var days = records
            .GroupBy(record => record.EvaluationDate)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                var dayObservations = group.SelectMany(record => record.Observations).ToArray();
                var dayLow = SumQuantityForWeight(dayObservations, 0.3m);
                var dayMedium = SumQuantityForWeight(dayObservations, 1m);
                var dayHigh = SumQuantityForWeight(dayObservations, 3m);
                return new ConsolidationDayDto(
                    group.Key,
                    group.Count(),
                    group.Sum(record => record.ObservedPeople ?? 0m),
                    dayLow + dayMedium + dayHigh,
                    (dayLow * 0.3m) + dayMedium + (dayHigh * 3m),
                    dayLow,
                    dayMedium,
                    dayHigh);
            }).ToArray();

        var categories = observations
            .GroupBy(observation => new { observation.CategoryCode, observation.CategoryName })
            .Select(group => new ConsolidationCategoryDto(group.Key.CategoryCode, group.Key.CategoryName, group.Sum(value => value.Quantity ?? 0m)))
            .OrderBy(value => value.Name)
            .ToArray();
        var items = observations
            .GroupBy(observation => new { observation.CategoryCode, observation.CategoryName, observation.ItemCode, observation.ItemName })
            .Select(group => new ConsolidationItemDto(group.Key.CategoryCode, group.Key.CategoryName, group.Key.ItemCode, group.Key.ItemName, group.Sum(value => value.Quantity ?? 0m)))
            .OrderBy(value => value.Category)
            .ThenBy(value => value.Name)
            .ToArray();

        return new DataConsolidationDto(
            from,
            to,
            records.Count,
            records.Sum(record => record.ObservedPeople ?? 0m),
            deviations,
            (low * 0.3m) + medium + (high * 3m),
            low,
            medium,
            high,
            days,
            categories,
            items,
            "REGRA A VALIDAR: o agrupamento S1-S5 depende da regra de calendário da planilha.");
    }

    private static void ValidateReferences(CreateEvaluationRequest request, EvaluationReferenceData references)
    {
        var errors = new List<string>();
        foreach (var observation in request.Observations)
        {
            if (!references.Items.ContainsKey(observation.ChecklistItemId))
            {
                errors.Add($"Item de checklist inexistente: {observation.ChecklistItemId}.");
            }

            if (observation.SeverityLevelId is Guid severityId && !references.Severities.ContainsKey(severityId))
            {
                errors.Add($"Severidade inexistente: {severityId}.");
            }
        }

        ValidateOptionalReference(request.SiteId, references.Sites, "Local", errors);
        ValidateOrganization(request.ClientOrganizationId, references.Organizations, OrganizationKind.Client, "Cliente", errors);
        ValidateOrganization(request.ContractorOrganizationId, references.Organizations, OrganizationKind.Contractor, "Contratada", errors);
        ValidateOrganization(request.SubcontractorOrganizationId, references.Organizations, OrganizationKind.Subcontractor, "Subcontratada", errors);

        if (errors.Count > 0)
        {
            throw new EvaluationValidationException(errors);
        }
    }

    private static void ValidateNoDuplicateItems(CreateEvaluationRequest request)
    {
        if (request.Observations.GroupBy(observation => observation.ChecklistItemId).Any(group => group.Count() > 1))
        {
            throw new EvaluationValidationException(["Cada item pode aparecer apenas uma vez na avaliação."]);
        }
    }

    private static decimal SumQuantityForWeight(
        IEnumerable<ConsolidationObservationRecord> observations,
        decimal weight) => observations
            .Where(observation => observation.SeverityWeight == weight)
            .Sum(observation => observation.Quantity ?? 0m);

    private static void ApplyRequest(
        Evaluation evaluation,
        CreateEvaluationRequest request,
        EvaluationReferenceData references)
    {
        evaluation.EvaluationDate = request.EvaluationDate;
        evaluation.EvaluationTime = request.EvaluationTime;
        evaluation.SiteId = request.SiteId;
        evaluation.Site = request.SiteId is Guid siteId ? references.Sites[siteId] : null;
        evaluation.ClientOrganizationId = request.ClientOrganizationId;
        evaluation.ClientOrganization = request.ClientOrganizationId is Guid clientId ? references.Organizations[clientId] : null;
        evaluation.ContractorOrganizationId = request.ContractorOrganizationId;
        evaluation.ContractorOrganization = request.ContractorOrganizationId is Guid contractorId ? references.Organizations[contractorId] : null;
        evaluation.SubcontractorOrganizationId = request.SubcontractorOrganizationId;
        evaluation.SubcontractorOrganization = request.SubcontractorOrganizationId is Guid subcontractorId ? references.Organizations[subcontractorId] : null;
        evaluation.LeadAuditorName = Normalize(request.LeadAuditorName);
        evaluation.AuditorName = Normalize(request.AuditorName);
        evaluation.CompanionName = Normalize(request.CompanionName);
        evaluation.ObservedPeople = request.ObservedPeople;
        evaluation.Strengths = Normalize(request.Strengths);
        evaluation.ImprovementOpportunities = Normalize(request.ImprovementOpportunities);
        var requestedItemIds = request.Observations
            .Select(observation => observation.ChecklistItemId)
            .ToHashSet();
        foreach (var removedObservation in evaluation.Observations
            .Where(observation => !requestedItemIds.Contains(observation.ChecklistItemId))
            .ToArray())
        {
            evaluation.Observations.Remove(removedObservation);
        }

        foreach (var input in request.Observations)
        {
            var observation = evaluation.Observations
                .SingleOrDefault(existing => existing.ChecklistItemId == input.ChecklistItemId);
            if (observation is null)
            {
                observation = new EvaluationObservation
                {
                    ChecklistItemId = input.ChecklistItemId,
                    ChecklistItem = references.Items[input.ChecklistItemId]
                };
                evaluation.Observations.Add(observation);
            }

            observation.Quantity = input.Quantity;
            observation.SeverityLevelId = input.SeverityLevelId;
            observation.SeverityLevel = input.SeverityLevelId is Guid severityId
                ? references.Severities[severityId]
                : null;
            observation.Comment = Normalize(input.Comment);
        }
    }

    private static void ValidateOptionalReference<T>(
        Guid? id,
        IReadOnlyDictionary<Guid, T> references,
        string label,
        ICollection<string> errors)
    {
        if (id is Guid value && !references.ContainsKey(value))
        {
            errors.Add($"{label} inexistente.");
        }
    }

    private static void ValidateOrganization(
        Guid? id,
        IReadOnlyDictionary<Guid, Organization> organizations,
        OrganizationKind expectedKind,
        string label,
        ICollection<string> errors)
    {
        if (id is not Guid value)
        {
            return;
        }

        if (!organizations.TryGetValue(value, out var organization) || organization.Kind != expectedKind)
        {
            errors.Add($"{label} inexistente ou com tipo inválido.");
        }
    }

    private static EvaluationDto ToDto(Evaluation evaluation)
    {
        var calculation = IdsCalculator.Calculate(
            evaluation.Observations.Select(observation => new ObservationInput(
                observation.Quantity,
                observation.SeverityLevel?.Weight)),
            evaluation.ObservedPeople ?? 0m);

        return new EvaluationDto(
            evaluation.Id,
            evaluation.EvaluationDate,
            evaluation.EvaluationTime,
            evaluation.Status.ToString(),
            evaluation.SiteId,
            evaluation.ClientOrganizationId,
            evaluation.ContractorOrganizationId,
            evaluation.SubcontractorOrganizationId,
            evaluation.Site?.Name,
            evaluation.Site?.ProjectOrIsland,
            evaluation.ClientOrganization?.Name,
            evaluation.ContractorOrganization?.Name,
            evaluation.SubcontractorOrganization?.Name,
            evaluation.LeadAuditorName,
            evaluation.AuditorName,
            evaluation.CompanionName,
            evaluation.Strengths,
            evaluation.ImprovementOpportunities,
            new EvaluationIndicatorsDto(
                evaluation.ObservedPeople,
                calculation.TotalDeviations,
                calculation.WeightedDeviationTotal,
                calculation.Score,
                calculation.LowSeverityShare,
                calculation.MediumSeverityShare,
                calculation.HighSeverityShare),
            evaluation.Observations
                .OrderBy(observation => observation.ChecklistItem.Category.SortOrder)
                .ThenBy(observation => observation.ChecklistItem.SortOrder)
                .Select(observation =>
                {
                    var input = new ObservationInput(observation.Quantity, observation.SeverityLevel?.Weight);
                    return new EvaluationObservationDto(
                        observation.ChecklistItemId,
                        observation.ChecklistItem.Category.Name,
                        observation.ChecklistItem.Name,
                        observation.Quantity,
                        observation.SeverityLevel?.Weight,
                        observation.Comment,
                        input.HasIncompleteQuantitySeverityPair);
                }).ToArray(),
            evaluation.CreatedAtUtc,
            evaluation.UpdatedAtUtc);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static decimal? CalculateShare(decimal count, decimal total) => count > 0 ? count / total : null;

    private static void ValidatePeriod(DateOnly? from, DateOnly? to)
    {
        if (from > to)
        {
            throw new EvaluationValidationException(["A data inicial deve ser anterior ou igual à data final."]);
        }
    }
}