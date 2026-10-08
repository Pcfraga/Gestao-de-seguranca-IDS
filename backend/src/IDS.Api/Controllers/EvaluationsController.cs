using IDS.Application.Evaluations;
using IDS.Application.Reports;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await evaluationService.ListAsync(from, to, siteId, contractorId, cancellationToken));
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
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var categories = await dbContext.ObservationCategories
            .AsNoTracking()
            .OrderBy(category => category.SortOrder)
            .Select(category => new
            {
                category.Id,
                category.Code,
                category.Name,
                Items = category.Items
                    .Where(item => item.IsActive)
                    .OrderBy(item => item.SortOrder)
                    .Select(item => new { item.Id, item.Code, item.Name })
            })
            .ToArrayAsync(cancellationToken);
        var severities = await dbContext.SeverityLevels
            .AsNoTracking()
            .OrderBy(severity => severity.SortOrder)
            .Select(severity => new { severity.Id, severity.Name, severity.Weight })
            .ToArrayAsync(cancellationToken);
        var sites = await dbContext.Sites
            .AsNoTracking()
            .OrderBy(site => site.Name)
            .Select(site => new { site.Id, site.Name, site.ProjectOrIsland })
            .ToArrayAsync(cancellationToken);
        var organizations = await dbContext.Organizations
            .AsNoTracking()
            .OrderBy(organization => organization.Name)
            .Select(organization => new { organization.Id, organization.Name, Kind = organization.Kind.ToString() })
            .ToArrayAsync(cancellationToken);

        return Ok(new { categories, severities, sites, organizations });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPost("sites")]
    public async Task<IActionResult> CreateSite(CreateSiteRequest request, CancellationToken cancellationToken)
    {
        var site = new Site
        {
            Name = request.Name.Trim(),
            ProjectOrIsland = string.IsNullOrWhiteSpace(request.ProjectOrIsland) ? null : request.ProjectOrIsland.Trim()
        };
        dbContext.Sites.Add(site);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created("/api/catalog", new { site.Id, site.Name, site.ProjectOrIsland });
    }

    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    [HttpPost("organizations")]
    public async Task<IActionResult> CreateOrganization(
        CreateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<OrganizationKind>(request.Kind, true, out var kind))
        {
            return BadRequest(new { message = "Tipo deve ser Client, Contractor ou Subcontractor." });
        }

        var organization = new Organization { Name = request.Name.Trim(), Kind = kind };
        dbContext.Organizations.Add(organization);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created("/api/catalog", new { organization.Id, organization.Name, Kind = organization.Kind.ToString() });
    }
}

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
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await evaluationService.GetDataConsolidationAsync(from, to, siteId, contractorId, cancellationToken));
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
        CancellationToken cancellationToken)
    {
        try
        {
            var totals = await evaluationService.GetPeriodTotalsAsync(from, to, siteId, contractorId, cancellationToken);
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
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await reportService.GetYearAsync(year, contractorId, cancellationToken));
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
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await reportService.GetMonthlySuggestionAsync(year, month, contractorId, cancellationToken));
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