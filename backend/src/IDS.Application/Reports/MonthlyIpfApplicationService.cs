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
        Guid? formId = null,
        Guid? siteId = null)
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

        siteId = await ResolveSiteAsync(siteId, cancellationToken);
        var records = await repository.GetYearAsync(year, contractorId, cancellationToken, areaId, formId, siteId);
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
            formName,
            siteId);
    }

    public async Task<MonthlyIpfSuggestionDto> GetMonthlySuggestionAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null,
        Guid? siteId = null)
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

        siteId = await ResolveSiteAsync(siteId, cancellationToken);
        if (siteId.HasValue)
        {
            if (areaId.HasValue || formId.HasValue)
                throw new IpfReportValidationException(["O IPF por projeto usa todas as disciplinas da composição, sem recorte de área ou formulário."]);
            var preview = await repository.GetProjectAverageAsync(year, month, contractorId, siteId.Value, cancellationToken)
                ?? throw new IpfReportValidationException(["Configure a composição do projeto primeiro."]);
            return new(year, month, contractorId, preview.Value,
                preview.Areas.Sum(area => area.EvaluationCount),
                preview.Areas.Sum(area => area.ScoredEvaluationCount), areaId, formId, siteId);
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

        var siteId = await ResolveSiteAsync(request.SiteId, cancellationToken);
        if (siteId.HasValue && (areaId.HasValue || formId.HasValue))
            throw new IpfReportValidationException(["O IPF por projeto usa todas as disciplinas da composição, sem recorte de área ou formulário."]);
        if (siteId.HasValue && (!request.MultiplicationFactor.HasValue || !request.AdditionalScore.HasValue))
            throw new IpfReportValidationException(["Informe o fator multiplicador e a parcela adicional para calcular o IPF do projeto."]);

        if (request.MultiplicationFactor.HasValue != request.AdditionalScore.HasValue)
        {
            throw new IpfReportValidationException(["Informe o fator multiplicador e a parcela adicional para calcular o IPF."]);
        }

        decimal? idsSnapshot = null;
        if (request.MultiplicationFactor is decimal factor && request.AdditionalScore is decimal additionalScore)
        {
            decimal idsAverage;
            if (siteId.HasValue)
            {
                var preview = await repository.GetProjectAverageAsync(year, month, request.ContractorOrganizationId, siteId.Value, cancellationToken)
                    ?? throw new IpfReportValidationException(["Configure a composição do projeto primeiro."]);
                idsAverage = preview.Value
                    ?? throw new IpfReportValidationException(["Não há avaliações com IDS calculável para a composição do projeto neste mês."]);
                idsSnapshot = idsAverage;
            }
            else if (request.UseDisciplineAverage)
            {
                idsAverage = await repository.GetDisciplineAverageAsync(
                    year, month, request.ContractorOrganizationId, cancellationToken)
                    ?? throw new IpfReportValidationException([
                        "Salve primeiro a média de IDS por disciplinas para usar esta opção."
                    ]);
            }
            else
            {
                var scores = await repository.GetMonthlyEvaluationScoresAsync(
                    year, month, request.ContractorOrganizationId, cancellationToken, areaId, formId);
                var validScores = scores.Where(score => score.HasValue).Select(score => score!.Value).ToArray();
                if (validScores.Length == 0)
                {
                    throw new IpfReportValidationException(["Não há avaliações com IDS calculável neste mês e recorte para calcular o IPF."]);
                }
                idsAverage = validScores.Average();
            }

            decimal value;
            try
            {
                var idsPercentage = idsAverage * 100m;
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
            request with { AreaId = areaId, FormId = formId, SiteId = siteId },
            cancellationToken,
            idsSnapshot);
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
        record.AdditionalScore,
        record.IdsAverage);

    public async Task<ProjectIdsAverageDto?> GetProjectAverageAsync(int year, int month, Guid contractorId, Guid siteId, CancellationToken cancellationToken)
    {
        ValidatePeriod(year, month);
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken);
        if (contractor is null || contractor.Kind != OrganizationKind.Contractor)
            throw new IpfReportValidationException(["Contratada não encontrada para esta empresa."]);
        var canonical = await ResolveSiteAsync(siteId, cancellationToken);
        return await repository.GetProjectAverageAsync(year, month, contractorId, canonical!.Value, cancellationToken);
    }

    public async Task<AssociateLegacyIpfResult> AssociateLegacyAsync(Guid contractorId, Guid siteId, CancellationToken cancellationToken)
    {
        var contractor = await repository.GetContractorAsync(contractorId, cancellationToken);
        if (contractor is null || contractor.Kind != OrganizationKind.Contractor)
            throw new IpfReportValidationException(["Contratada não encontrada para esta empresa."]);
        var canonical = await ResolveSiteAsync(siteId, cancellationToken);
        return await repository.AssociateLegacyAsync(contractorId, canonical!.Value, cancellationToken);
    }

    private async Task<Guid?> ResolveSiteAsync(Guid? siteId, CancellationToken cancellationToken)
    {
        if (!siteId.HasValue) return null;
        return await repository.ResolveSiteIdAsync(siteId.Value, cancellationToken)
            ?? throw new IpfReportValidationException(["Projeto não encontrado para esta empresa."]);
    }

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