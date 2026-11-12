using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed class MonthlyIpfApplicationService(IMonthlyIpfRepository repository)
{
    public async Task<IpfAnnualHistoryDto> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null)
    {
        ValidatePeriod(year, 1);
        (areaId, formId) = CanonicalizeScope(areaId, formId);
        var (areaName, formName) = await repository.ValidateScopeAsync(areaId, formId, cancellationToken);
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        var records = await repository.GetYearAsync(year, contractorId, cancellationToken, areaId, formId);
        var months = records.OrderBy(record => record.Month).Select(ToDto).ToArray();
        return new IpfAnnualHistoryDto(
            year,
            contractor.Id,
            contractor.Name,
            months.Length > 0 ? months.Average(record => record.Value) : null,
            months,
            areaId,
            formId,
            areaName,
            formName);
    }

    public async Task<MonthlyIpfSuggestionDto> GetMonthlySuggestionAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null)
    {
        ValidatePeriod(year, month);
        (areaId, formId) = CanonicalizeScope(areaId, formId);
        await repository.ValidateScopeAsync(areaId, formId, cancellationToken);
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        var scores = await repository.GetMonthlyEvaluationScoresAsync(
            year, month, contractorId, cancellationToken, areaId, formId);
        var validScores = scores.Where(score => score.HasValue).Select(score => score!.Value).ToArray();
        return new MonthlyIpfSuggestionDto(
            year,
            month,
            contractorId,
            validScores.Length > 0 ? decimal.Round(validScores.Average(), 4, MidpointRounding.AwayFromZero) : null,
            scores.Count,
            validScores.Length,
            areaId,
            formId);
    }

    public async Task<MonthlyIpfValueDto> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(year, month);
        var (areaId, formId) = CanonicalizeScope(request.AreaId, request.FormId);
        await repository.ValidateScopeAsync(areaId, formId, cancellationToken);
        var contractor = await repository.GetContractorAsync(request.ContractorOrganizationId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        if (request.SiteId.HasValue)
        {
            throw new IpfReportValidationException(["O IPF é geral da contratada e não pode ser salvo por projeto."]);
        }

        if (request.MultiplicationFactor.HasValue != request.AdditionalScore.HasValue)
        {
            throw new IpfReportValidationException(["Informe o fator multiplicador e a parcela adicional para calcular o IPF."]);
        }

        if (request.MultiplicationFactor is decimal factor && request.AdditionalScore is decimal additionalScore)
        {
            var scores = await repository.GetMonthlyEvaluationScoresAsync(
                year, month, request.ContractorOrganizationId, cancellationToken, areaId, formId);
            var validScores = scores.Where(score => score.HasValue).Select(score => score!.Value).ToArray();
            if (validScores.Length == 0)
            {
                throw new IpfReportValidationException(["Não há avaliações com IDS calculável neste mês e recorte para calcular o IPF."]);
            }

            decimal value;
            try
            {
                var idsPercentage = validScores.Average() * 100m;
                value = decimal.Round(((idsPercentage * 60m * factor / 100m) + additionalScore) / 10m,
                    4, MidpointRounding.AwayFromZero);
            }
            catch (OverflowException)
            {
                throw new IpfReportValidationException(["Os valores informados excedem o limite numérico do cálculo do IPF."]);
            }

            if (value is < -99999999.9999m or > 99999999.9999m)
            {
                throw new IpfReportValidationException(["O resultado do IPF excede o limite numérico de armazenamento."]);
            }

            request = request with { Value = value };
        }

        var record = await repository.UpsertAsync(
            year,
            month,
            request with { AreaId = areaId, FormId = formId },
            cancellationToken);
        record.ContractorOrganization = contractor;
        return ToDto(record);
    }

    private static MonthlyIpfValueDto ToDto(MonthlyIpfRecord record) => new(
        record.Id,
        record.Year,
        record.Month,
        record.ContractorOrganizationId,
        record.ContractorOrganization.Name,
        record.Site?.CanonicalSiteId ?? record.SiteId,
        record.Site?.CanonicalSite?.Name ?? record.Site?.Name,
        record.Value,
        record.Source,
        record.UpdatedAtUtc,
        record.AreaId,
        record.FormId,
        record.MultiplicationFactor,
        record.AdditionalScore);

    private static (Guid? AreaId, Guid? FormId) CanonicalizeScope(Guid? areaId, Guid? formId) =>
        (areaId is Guid area && area != Guid.Empty ? area : null,
            formId is Guid form && form != Guid.Empty ? form : null);

    private static void ValidatePeriod(int year, int month)
    {
        if (year is < 2000 or > 2200)
        {
            throw new IpfReportValidationException(["Ano inválido."]);
        }

        if (month is < 1 or > 12)
        {
            throw new IpfReportValidationException(["Mês deve estar entre 1 e 12."]);
        }
    }
}