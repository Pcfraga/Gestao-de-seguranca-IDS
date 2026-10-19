using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed class IpfCompositionApplicationService(IIpfCompositionRepository repository)
{
    public async Task<IpfCompositionYearDto> GetYearAsync(int year, Guid contractorId, CancellationToken cancellationToken)
    {
        ValidatePeriod(year, 1);
        var contractor = await ValidateContractorAsync(contractorId, cancellationToken);
        var records = await repository.GetYearAsync(year, contractorId, cancellationToken);
        var months = records.OrderBy(record => record.Month).Select(ToDto).ToArray();
        return new(year, contractorId, contractor.Name,
            months.Length == 0 ? null : months.Average(month => month.Value!.Value), months);
    }

    public async Task<CompositionDto> PreviewAsync(
        int year, int month, IpfCompositionRequest? request, CancellationToken cancellationToken)
    {
        ValidatePeriod(year, month);
        if (request?.ContractorOrganizationId is not Guid contractorId || contractorId == Guid.Empty)
            throw Invalid("Informe a contratada.");
        if (request.Areas is null || request.Areas.Count is < 1 or > 4
            || request.Areas.Any(area => area?.AreaId is null || area.Weight is null)
            || request.Areas.Select(area => area!.AreaId).Distinct().Count() != request.Areas.Count
            || request.Areas.Any(area => area!.Weight is < 0 or > 100)
            || request.Areas.Sum(area => area!.Weight!.Value) != 100m)
            throw Invalid("Selecione de 1 a 4 áreas distintas, com pesos entre 0 e 100 e soma igual a 100.");
        var contractor = await ValidateContractorAsync(contractorId, cancellationToken);
        var names = await repository.GetAreaNamesAsync(cancellationToken);
        if (request.Areas.Any(area => !names.ContainsKey(area!.AreaId!.Value)))
            throw Invalid("Área de inspeção não encontrada para esta empresa.");
        var scores = await repository.GetScoresAsync(year, month, contractorId, cancellationToken);
        var calculation = IpfCompositionCalculator.Calculate(request.Areas.Select(area => new IpfAreaInput(
            area!.AreaId!.Value, area.Weight!.Value,
            scores.TryGetValue(area.AreaId.Value, out var values) ? values : [])).ToArray());
        return new(null, year, month, contractorId, contractor.Name, calculation.Value,
            calculation.Areas.Select(area => new CompositionAreaDto(area.AreaId, names[area.AreaId],
                area.Weight, area.EffectiveWeight, area.Average, area.EvaluationCount,
                area.ScoredEvaluationCount, area.Contribution, area.Status)).ToArray(), null);
    }

    public async Task<CompositionDto> SaveAsync(
        int year, int month, IpfCompositionRequest? request, CancellationToken cancellationToken)
    {
        var preview = await PreviewAsync(year, month, request, cancellationToken);
        if (preview.Value is null)
            throw Invalid("Não é possível salvar: nenhuma área com peso positivo possui média de IDS.");
        var snapshot = new IpfComposition
        {
            Year = year, Month = month, ContractorOrganizationId = preview.ContractorOrganizationId,
            ContractorName = preview.Contractor, Value = preview.Value.Value,
            Areas = preview.Areas.Select((area, position) => new IpfCompositionArea
            {
                Position = position, AreaId = area.AreaId, AreaName = area.AreaName, Weight = area.Weight,
                EffectiveWeight = area.EffectiveWeight, Average = area.Average,
                EvaluationCount = area.EvaluationCount, ScoredEvaluationCount = area.ScoredEvaluationCount,
                Contribution = area.Contribution, Status = area.Status
            }).ToList()
        };
        return ToDto(await repository.UpsertAsync(snapshot, cancellationToken));
    }

    private async Task<Organization> ValidateContractorAsync(Guid id, CancellationToken cancellationToken)
    {
        var contractor = await repository.GetContractorAsync(id, cancellationToken);
        if (contractor is null || contractor.Kind != OrganizationKind.Contractor)
            throw Invalid("Contratada não encontrada para esta empresa ou organização não é uma contratada.");
        return contractor;
    }

    private static CompositionDto ToDto(IpfComposition record) => new(
        record.Id, record.Year, record.Month, record.ContractorOrganizationId, record.ContractorName,
        record.Value, record.Areas.OrderBy(area => area.Position).Select(area => new CompositionAreaDto(
            area.AreaId, area.AreaName, area.Weight, area.EffectiveWeight, area.Average,
            area.EvaluationCount, area.ScoredEvaluationCount, area.Contribution, area.Status)).ToArray(), record.UpdatedAtUtc);

    private static void ValidatePeriod(int year, int month)
    {
        if (year is < 2000 or > 2200) throw Invalid("Ano deve estar entre 2000 e 2200.");
        if (month is < 1 or > 12) throw Invalid("Mês deve estar entre 1 e 12.");
    }

    private static IpfReportValidationException Invalid(string error) => new([error]);
}
