using IDS.Domain.Calculations;
using IDS.Domain.Entities;

namespace IDS.Application.Reports;

public sealed class MonthlyIpfApplicationService(IMonthlyIpfRepository repository)
{
    public async Task<IpfAnnualHistoryDto> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(year, 1);
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        var records = await repository.GetYearAsync(year, contractorId, cancellationToken);
        var months = records.OrderBy(record => record.Month).Select(ToDto).ToArray();
        return new IpfAnnualHistoryDto(
            year,
            contractor.Id,
            contractor.Name,
            months.Length > 0 ? months.Average(record => record.Value) : null,
            months);
    }

    public async Task<MonthlyIpfSuggestionDto> GetMonthlySuggestionAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(year, month);
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        var scores = await repository.GetMonthlyEvaluationScoresAsync(year, month, contractorId, cancellationToken);
        var validScores = scores.Where(score => score.HasValue).Select(score => score!.Value).ToArray();
        return new MonthlyIpfSuggestionDto(
            year,
            month,
            contractorId,
            validScores.Length > 0 ? decimal.Round(validScores.Average(), 4, MidpointRounding.AwayFromZero) : null,
            scores.Count,
            validScores.Length);
    }

    public async Task<MonthlyIpfValueDto> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken)
    {
        ValidatePeriod(year, month);
        var contractor = await repository.GetContractorAsync(request.ContractorOrganizationId, cancellationToken)
            ?? throw new IpfReportValidationException(["Contratada não encontrada."]);
        if (contractor.Kind != OrganizationKind.Contractor)
        {
            throw new IpfReportValidationException(["A organização selecionada não é uma contratada."]);
        }

        if (request.SiteId is Guid siteId && !await repository.SiteExistsAsync(siteId, cancellationToken))
        {
            throw new IpfReportValidationException(["Local não encontrado."]);
        }

        var record = await repository.UpsertAsync(year, month, request, cancellationToken);
        record.ContractorOrganization = contractor;
        return ToDto(record);
    }

    private static MonthlyIpfValueDto ToDto(MonthlyIpfRecord record) => new(
        record.Id,
        record.Year,
        record.Month,
        record.ContractorOrganizationId,
        record.ContractorOrganization.Name,
        record.SiteId,
        record.Site?.Name,
        record.Value,
        record.Source,
        record.UpdatedAtUtc);

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