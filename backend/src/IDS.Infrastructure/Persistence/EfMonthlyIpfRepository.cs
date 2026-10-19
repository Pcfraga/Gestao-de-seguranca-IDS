using IDS.Application.Reports;
using IDS.Domain.Calculations;
using IDS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IDS.Infrastructure.Persistence;

public sealed class EfMonthlyIpfRepository(IdsDbContext dbContext, ICurrentUserScope userScope) : IMonthlyIpfRepository
{
    public Task<Organization?> GetContractorAsync(Guid contractorId, CancellationToken cancellationToken) =>
        dbContext.Organizations.AsNoTracking()
            .SingleOrDefaultAsync(organization => organization.Id == contractorId, cancellationToken);

    public Task<bool> SiteExistsAsync(Guid siteId, CancellationToken cancellationToken) =>
        dbContext.Sites.AsNoTracking().AnyAsync(site => site.Id == siteId, cancellationToken);

    public async Task<IReadOnlyCollection<MonthlyIpfRecord>> GetYearAsync(
        int year,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null)
    {
        areaId = Canonicalize(areaId);
        formId = Canonicalize(formId);
        return await dbContext.MonthlyIpfRecords
            .AsNoTracking()
            .Include(record => record.ContractorOrganization)
            .Include(record => record.Site)
            .Where(record => record.Year == year
                && record.ContractorOrganizationId == contractorId
                && record.AreaId == areaId
                && record.FormId == formId)
            .OrderBy(record => record.Month)
            .ToArrayAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<decimal?>> GetMonthlyEvaluationScoresAsync(
        int year,
        int month,
        Guid contractorId,
        CancellationToken cancellationToken,
        Guid? areaId = null,
        Guid? formId = null)
    {
        areaId = Canonicalize(areaId);
        formId = Canonicalize(formId);
        var monthStart = new DateOnly(year, month, 1);
        var nextMonthStart = month == 12
            ? new DateOnly(year + 1, 1, 1)
            : new DateOnly(year, month + 1, 1);
        var evaluations = await dbContext.Evaluations
            .AsNoTracking()
            .Where(evaluation => userScope.IsAdministrator || evaluation.CreatedByUserId == userScope.UserId)
            .Where(evaluation => evaluation.ContractorOrganizationId == contractorId
                && evaluation.EvaluationDate >= monthStart
                && evaluation.EvaluationDate < nextMonthStart)
            .Where(evaluation => areaId.HasValue
                ? evaluation.FormVersion != null && evaluation.FormVersion.AreaId == areaId
                : evaluation.FormVersion == null || evaluation.FormVersion.AreaId == null)
            .Where(evaluation => formId.HasValue
                ? evaluation.FormVersion != null && evaluation.FormVersion.FormId == formId
                : evaluation.FormVersion == null || evaluation.FormVersion.Form.IsDefault)
            .Include(evaluation => evaluation.Observations)
                .ThenInclude(observation => observation.SeverityLevel)
            .ToArrayAsync(cancellationToken);

        return evaluations.Select(evaluation => IdsCalculator.Calculate(
            evaluation.Observations.Select(observation => new ObservationInput(
                observation.Quantity,
                observation.SeverityLevel?.Weight)),
            evaluation.ObservedPeople ?? 0m).Score).ToArray();
    }

    public async Task<(string AreaName, string FormName)> ValidateScopeAsync(
        Guid? areaId,
        Guid? formId,
        CancellationToken cancellationToken)
    {
        areaId = Canonicalize(areaId);
        formId = Canonicalize(formId);

        var areaName = InspectionArea.DefaultName;
        if (areaId.HasValue && !await dbContext.InspectionAreas
            .AnyAsync(area => area.Id == areaId, cancellationToken))
        {
            throw new IpfReportValidationException(["Área de inspeção não encontrada para esta empresa."]);
        }
        else if (areaId.HasValue)
        {
            areaName = await dbContext.InspectionAreas
                .Where(area => area.Id == areaId)
                .Select(area => area.Name)
                .SingleAsync(cancellationToken);
        }

        if (!formId.HasValue)
        {
            if (areaId.HasValue)
            {
                throw new IpfReportValidationException(["A área selecionada não possui o formulário padrão de SST."]);
            }

            return (areaName, "Formulário padrão");
        }

        var form = await dbContext.InspectionForms
            .AsNoTracking()
            .SingleOrDefaultAsync(value => value.Id == formId, cancellationToken);
        if (form is null || form.IsDefault)
        {
            throw new IpfReportValidationException(["Tipo de formulário não encontrado para esta empresa."]);
        }

        var hasRevision = await dbContext.InspectionFormVersions
            .AsNoTracking()
            .AnyAsync(version => version.FormId == formId, cancellationToken);
        if (!hasRevision)
        {
            throw new IpfReportValidationException(["Tipo de formulário não encontrado para esta empresa."]);
        }

        var latestRevision = await dbContext.InspectionFormVersions
            .AsNoTracking()
            .Where(version => version.FormId == formId)
            .OrderByDescending(version => version.Version)
            .Select(version => new { version.AreaId, version.Name })
            .FirstOrDefaultAsync(cancellationToken);
        if (latestRevision!.AreaId != areaId)
        {
            throw new IpfReportValidationException(["O formulário não pertence à área de inspeção selecionada."]);
        }

        return (areaName, latestRevision.Name);
    }

    public async Task<MonthlyIpfRecord> UpsertAsync(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken)
    {
        var areaId = Canonicalize(request.AreaId);
        var formId = Canonicalize(request.FormId);
        var record = await dbContext.MonthlyIpfRecords
            .Include(value => value.ContractorOrganization)
            .Include(value => value.Site)
            .SingleOrDefaultAsync(value => value.Year == year
                && value.Month == month
                && value.ContractorOrganizationId == request.ContractorOrganizationId
                && value.AreaId == areaId
                && value.FormId == formId, cancellationToken);

        if (record is null)
        {
            record = new MonthlyIpfRecord
            {
                Year = year,
                Month = month,
                ContractorOrganizationId = request.ContractorOrganizationId,
                AreaId = areaId,
                FormId = formId,
                ContractorOrganization = await dbContext.Organizations.SingleAsync(
                    organization => organization.Id == request.ContractorOrganizationId,
                    cancellationToken)
            };
            dbContext.MonthlyIpfRecords.Add(record);
        }

        record.SiteId = request.SiteId;
        record.Site = request.SiteId is Guid siteId
            ? await dbContext.Sites.SingleAsync(site => site.Id == siteId, cancellationToken)
            : null;
        record.Value = request.Value;
        record.Source = "Manual";
        await dbContext.SaveChangesAsync(cancellationToken);
        return record;
    }

    private static Guid? Canonicalize(Guid? id) => id is Guid value && value != Guid.Empty ? value : null;
}