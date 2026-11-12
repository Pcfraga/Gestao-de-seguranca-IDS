using IDS.Application.Evaluations;
using IDS.Application.Reports;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using Npgsql;

namespace IDS.Api.Controllers;

[ApiController]
[Route("api/evaluations")]
public sealed class EvaluationsController(EvaluationApplicationService evaluationService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<EvaluationDto>>> List(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? siteId,
        [FromQuery] Guid? contractorId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? formId,
        [FromQuery] Guid? islandId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await evaluationService.ListAsync(from, to, siteId, contractorId, cancellationToken, new(areaId, formId, islandId)));
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["period"] = exception.Errors.ToArray() }));
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<EvaluationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EvaluationDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var evaluation = await evaluationService.GetAsync(id, cancellationToken);
        return evaluation is null ? NotFound() : Ok(evaluation);
    }

    [HttpPost]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR,AVALIADOR")]
    [ProducesResponseType<EvaluationDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EvaluationDto>> CreateDraft(
        CreateEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var evaluation = await evaluationService.CreateDraftAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { id = evaluation.Id }, evaluation);
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["evaluation"] = exception.Errors.ToArray() }));
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR,AVALIADOR")]
    [ProducesResponseType<EvaluationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EvaluationDto>> UpdateDraft(
        Guid id,
        CreateEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var evaluation = await evaluationService.UpdateDraftAsync(id, request, cancellationToken);
            return evaluation is null ? NotFound() : Ok(evaluation);
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["evaluation"] = exception.Errors.ToArray() }));
        }
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR,AVALIADOR")]
    [ProducesResponseType<EvaluationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EvaluationDto>> SubmitDraft(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var evaluation = await evaluationService.SubmitDraftAsync(id, cancellationToken);
            return evaluation is null ? NotFound() : Ok(evaluation);
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["evaluation"] = exception.Errors.ToArray() }));
        }
    }
}

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController(IdsDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken, [FromQuery] Guid? formVersionId = null)
    {
        if (formVersionId.HasValue && !await dbContext.InspectionFormVersions
            .AnyAsync(version => version.Id == formVersionId, cancellationToken))
        {
            return NotFound(new { message = "Versão de formulário não encontrada para esta empresa." });
        }

        var categories = await dbContext.ObservationCategories
            .AsNoTracking()
            .Where(category => category.FormVersionId == formVersionId)
            .OrderBy(category => category.SortOrder)
            .Select(category => new
            {
                category.Id,
                category.Code,
                category.Name,
                IsCustom = category.TenantId != null,
                Items = category.Items
                    .Where(item => item.IsActive)
                    .OrderBy(item => item.SortOrder)
                    .Select(item => new { item.Id, item.Code, item.Name, IsCustom = item.TenantId != null })
            })
            .ToArrayAsync(cancellationToken);
        var severities = await dbContext.SeverityLevels
            .AsNoTracking()
            .OrderBy(severity => severity.SortOrder)
            .Select(severity => new { severity.Id, severity.Name, severity.Weight })
            .ToArrayAsync(cancellationToken);
        var sites = await dbContext.Sites
            .AsNoTracking()
            .Where(site => site.CanonicalSiteId == null)
            .OrderBy(site => site.Name)
            .Select(site => new { site.Id, site.Name, site.ProjectOrIsland, site.IsActive })
            .ToArrayAsync(cancellationToken);
        var organizations = await dbContext.Organizations
            .AsNoTracking()
            .OrderBy(organization => organization.Name)
            .Select(organization => new { organization.Id, organization.Name, Kind = organization.Kind.ToString(), organization.IsActive })
            .ToArrayAsync(cancellationToken);

        return Ok(new { categories, severities, sites, organizations });
    }

    [Authorize(Roles = "ADMINISTRADOR")]
    [HttpPost("categories")]
    [HttpPut("categories/{id:guid}")]
    [HttpPost("categories/{categoryId:guid}/items")]
    [HttpPut("items/{id:guid}")]
    public IActionResult LegacyCatalogWrite() => Conflict(new
    {
        message = "Edite o formulário completo em Formulários de inspeção. Os itens antigos são preservados para manter o histórico."
    });

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPost("sites")]
    public async Task<IActionResult> CreateSite(CreateSiteRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 200)
            return BadRequest(new { message = "Informe um nome de projeto com até 200 caracteres." });
        var name = request.Name.Trim();
        var projectOrIsland = string.IsNullOrWhiteSpace(request.ProjectOrIsland) ? null : request.ProjectOrIsland.Trim();
        if (projectOrIsland?.Length > 200)
            return BadRequest(new { message = "O nome da ilha deve ter até 200 caracteres." });
        if (await dbContext.Sites.AnyAsync(value => value.CanonicalSiteId == null && value.Name.Trim().ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe um projeto com este nome." });
        var site = new Site
        {
            Name = name,
            ProjectOrIsland = projectOrIsland
        };
        dbContext.Sites.Add(site);
        if (!await SaveCatalog(cancellationToken)) return Conflict(new { message = "Já existe um projeto com este nome." });
        return Created("/api/catalog", new { site.Id, site.Name, site.ProjectOrIsland, site.IsActive });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPost("organizations")]
    public async Task<IActionResult> CreateOrganization(
        CreateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Trim().Length > 200)
            return BadRequest(new { message = "Informe um nome com até 200 caracteres." });
        if (!Enum.TryParse<OrganizationKind>(request.Kind, true, out var kind))
        {
            return BadRequest(new { message = "Tipo deve ser Client, Contractor ou Subcontractor." });
        }
        var name = request.Name.Trim();
        if (await dbContext.Organizations.AnyAsync(value => value.Kind == kind && value.Name.ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe uma organização com este nome e tipo." });

        var organization = new Organization { Name = name, Kind = kind };
        dbContext.Organizations.Add(organization);
        if (!await SaveCatalog(cancellationToken)) return Conflict(new { message = "Já existe uma organização com este nome e tipo." });
        return Created("/api/catalog", new { organization.Id, organization.Name, Kind = organization.Kind.ToString(), organization.IsActive });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPut("sites/{id:guid}")]
    public async Task<IActionResult> RenameSite(Guid id, RenameCatalogRequest request, CancellationToken cancellationToken)
    {
        var site = await dbContext.Sites.SingleOrDefaultAsync(value => value.Id == id && value.CanonicalSiteId == null, cancellationToken);
        if (site is null) return NotFound();
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Informe o nome do projeto." });
        if (await dbContext.Sites.AnyAsync(value => value.Id != id && value.CanonicalSiteId == null
            && value.Name.Trim().ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe um projeto com este nome." });
        site.Name = name;
        if (!await SaveCatalog(cancellationToken)) return Conflict(new { message = "Já existe um projeto com este nome." });
        return Ok(new { site.Id, site.Name, site.ProjectOrIsland, site.IsActive });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPut("sites/{id:guid}/active")]
    public async Task<IActionResult> SetSiteActive(Guid id, SetInspectionIslandActiveRequest request, CancellationToken cancellationToken)
    {
        if (!request.IsActive.HasValue) return BadRequest(new { message = "Informe a situação do projeto." });
        var site = await dbContext.Sites.SingleOrDefaultAsync(value => value.Id == id && value.CanonicalSiteId == null, cancellationToken);
        if (site is null) return NotFound();
        site.IsActive = request.IsActive.Value;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { site.Id, site.Name, site.ProjectOrIsland, site.IsActive });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPut("organizations/{id:guid}")]
    public async Task<IActionResult> RenameOrganization(Guid id, RenameCatalogRequest request, CancellationToken cancellationToken)
    {
        var organization = await dbContext.Organizations.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (organization is null) return NotFound();
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Informe o nome da organização." });
        if (await dbContext.Organizations.AnyAsync(value => value.Id != id && value.Kind == organization.Kind && value.Name.ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe uma organização deste tipo com este nome." });
        organization.Name = name;
        if (organization.Kind == OrganizationKind.Contractor)
        {
            var compositions = await dbContext.IpfCompositions.Where(value => value.ContractorOrganizationId == id).ToArrayAsync(cancellationToken);
            foreach (var composition in compositions) composition.ContractorName = name;
        }
        if (!await SaveCatalog(cancellationToken)) return Conflict(new { message = "Já existe uma organização deste tipo com este nome." });
        return Ok(new { organization.Id, organization.Name, Kind = organization.Kind.ToString(), organization.IsActive });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPut("organizations/{id:guid}/active")]
    public async Task<IActionResult> SetOrganizationActive(Guid id, SetInspectionIslandActiveRequest request, CancellationToken cancellationToken)
    {
        if (!request.IsActive.HasValue) return BadRequest(new { message = "Informe a situação da organização." });
        var organization = await dbContext.Organizations.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (organization is null) return NotFound();
        organization.IsActive = request.IsActive.Value;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { organization.Id, organization.Name, Kind = organization.Kind.ToString(), organization.IsActive });
    }

    private async Task<bool> SaveCatalog(CancellationToken cancellationToken)
    {
        try { await dbContext.SaveChangesAsync(cancellationToken); return true; }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return false; }
    }
}

public sealed record RenameCatalogRequest([Required, StringLength(200)] string Name);
public sealed record CreateSiteRequest(string Name, string? ProjectOrIsland);

public sealed record CreateOrganizationRequest(string Name, string Kind);

[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(EvaluationApplicationService evaluationService) : ControllerBase
{
    [HttpGet("data")]
    public async Task<ActionResult<DataConsolidationDto>> GetData(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? siteId,
        [FromQuery] Guid? contractorId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? formId,
        [FromQuery] Guid? islandId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await evaluationService.GetDataConsolidationAsync(from, to, siteId, contractorId, cancellationToken, new(areaId, formId, islandId)));
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["period"] = exception.Errors.ToArray() }));
        }
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? siteId,
        [FromQuery] Guid? contractorId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? formId,
        [FromQuery] Guid? islandId,
        CancellationToken cancellationToken)
    {
        try
        {
            var totals = await evaluationService.GetPeriodTotalsAsync(from, to, siteId, contractorId, cancellationToken, new(areaId, formId, islandId));
            return Ok(totals);
        }
        catch (EvaluationValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["period"] = exception.Errors.ToArray() }));
        }
    }
}

[ApiController]
[Route("api/reports/ipf")]
public sealed class IpfReportsController(MonthlyIpfApplicationService reportService) : ControllerBase
{
    [HttpGet("{year:int}")]
    public async Task<ActionResult<IpfAnnualHistoryDto>> GetYear(
        int year,
        [FromQuery] Guid contractorId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? formId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await reportService.GetYearAsync(year, contractorId, cancellationToken, areaId, formId));
        }
        catch (IpfReportValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["report"] = exception.Errors.ToArray() }));
        }
    }

    [HttpGet("{year:int}/{month:int}/suggestion")]
    public async Task<ActionResult<MonthlyIpfSuggestionDto>> GetMonthlySuggestion(
        int year,
        int month,
        [FromQuery] Guid contractorId,
        [FromQuery] Guid? areaId,
        [FromQuery] Guid? formId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await reportService.GetMonthlySuggestionAsync(year, month, contractorId, cancellationToken, areaId, formId));
        }
        catch (IpfReportValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["report"] = exception.Errors.ToArray() }));
        }
    }

    [HttpPut("{year:int}/{month:int}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<ActionResult<MonthlyIpfValueDto>> SaveMonth(
        int year,
        int month,
        UpsertMonthlyIpfRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await reportService.UpsertAsync(year, month, request, cancellationToken));
        }
        catch (IpfReportValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["report"] = exception.Errors.ToArray() }));
        }
    }
}