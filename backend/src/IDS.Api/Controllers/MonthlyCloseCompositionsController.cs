using IDS.Domain.Entities;
using IDS.Application.Reports;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IDS.Api.Controllers;

[ApiController]
[Route("api/monthly-close-compositions")]
public sealed class MonthlyCloseCompositionsController(
    IdsDbContext dbContext,
    ICurrentUserScope userScope,
    IMonthlyIpfRepository repository,
    MonthlyIpfApplicationService reportService) : ControllerBase
{
    [HttpGet("{siteId:guid}")]
    [ProducesResponseType<MonthlyCloseCompositionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MonthlyCloseCompositionDto>> Get(
        Guid siteId,
        CancellationToken cancellationToken)
    {
        var canonical = await repository.ResolveSiteIdAsync(siteId, cancellationToken);
        if (canonical is null) return NotFound();
        var compositions = await dbContext.MonthlyCloseCompositions
            .AsNoTracking()
            .Include(value => value.Areas)
            .Where(value => value.SiteId == canonical || value.Site.CanonicalSiteId == canonical)
            .ToArrayAsync(cancellationToken);
        if (compositions.Length > 1) return Conflict(new { message = "Há composições duplicadas para os aliases do projeto." });
        return compositions.Length == 0 ? NotFound() : Ok(ToDto(compositions[0], canonical.Value));
    }

    /// <summary>Prévia com pesos atuais; não altera nem representa o IDS salvo no IPF.</summary>
    [HttpGet("{siteId:guid}/average/{year:int}/{month:int}")]
    public async Task<ActionResult<ProjectIdsAverageDto>> GetAverage(
        Guid siteId, int year, int month, [FromQuery] Guid contractorId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await reportService.GetProjectAverageAsync(year, month, contractorId, siteId, cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (IpfReportValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["report"] = exception.Errors.ToArray() }));
        }
    }

    [HttpPut("{siteId:guid}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<ActionResult<MonthlyCloseCompositionDto>> Put(
        Guid siteId,
        MonthlyCloseCompositionRequest? request,
        CancellationToken cancellationToken)
    {
        var canonical = await repository.ResolveSiteIdAsync(siteId, cancellationToken);
        if (canonical is null) return NotFound();

        var areas = request?.Areas?
            .Where(area => area is not null)
            .Select(area => area!)
            .ToArray();
        if (areas is null || areas.Length is < 1 or > 4
            || areas.Any(area => area.Weight is < 0 or > 100)
            || areas.Any(area => decimal.Round(area.Weight, 2) != area.Weight)
            || areas.Sum(area => area.Weight) != 100m
            || areas.Select(area => area.AreaId).Distinct().Count() != areas.Length
            || areas.Count(area => area.Weight > 0) is < 1 or > 4)
            return BadRequest(new { message = "Selecione de 1 a 4 áreas distintas, com pesos de até duas casas decimais entre 0 e 100 e soma igual a 100." });

        var areaIds = areas.Select(area => area.AreaId).ToArray();
        var persistedAreaIds = areaIds.Where(id => id != Guid.Empty).ToArray();
        if (await dbContext.InspectionAreas.CountAsync(area => persistedAreaIds.Contains(area.Id), cancellationToken) != persistedAreaIds.Length)
            return BadRequest(new { message = "Área de inspeção não encontrada para esta empresa." });

        var compositions = await dbContext.MonthlyCloseCompositions
            .Include(value => value.Areas)
            .Where(value => value.SiteId == canonical || value.Site.CanonicalSiteId == canonical)
            .ToArrayAsync(cancellationToken);
        if (compositions.Length > 1) return Conflict(new { message = "Há composições duplicadas para os aliases do projeto." });
        var composition = compositions.SingleOrDefault();
        if (composition is null)
        {
            composition = new MonthlyCloseComposition
            {
                SiteId = canonical.Value,
                CreatedByUserId = userScope.UserId
            };
            dbContext.MonthlyCloseCompositions.Add(composition);
        }
        composition.SiteId = canonical.Value;
        var removed = composition.Areas.Where(existing => !areaIds.Contains(existing.AreaId)).ToArray();
        dbContext.MonthlyCloseCompositionAreas.RemoveRange(removed);
        foreach (var existing in removed) composition.Areas.Remove(existing);
        foreach (var existing in composition.Areas)
            existing.Weight = areas.Single(area => area.AreaId == existing.AreaId).Weight;
        var added = areas.Where(area => composition.Areas.All(existing => existing.AreaId != area.AreaId))
            .Select(area => new MonthlyCloseCompositionArea
        {
            AreaId = area.AreaId,
            Weight = area.Weight,
            CreatedByUserId = userScope.UserId,
            UpdatedByUserId = userScope.UserId
        }).ToArray();
        foreach (var area in added) composition.Areas.Add(area);
        dbContext.MonthlyCloseCompositionAreas.AddRange(added);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(composition, canonical.Value));
    }

    private static MonthlyCloseCompositionDto ToDto(MonthlyCloseComposition composition, Guid siteId) =>
        new(siteId, composition.Areas
            .Select(area => new MonthlyCloseCompositionAreaDto(area.AreaId, area.Weight))
            .ToArray());
}

public sealed record MonthlyCloseCompositionAreaDto(Guid AreaId, decimal Weight);
public sealed record MonthlyCloseCompositionDto(Guid SiteId, IReadOnlyCollection<MonthlyCloseCompositionAreaDto> Areas);
public sealed record MonthlyCloseCompositionRequest(IReadOnlyCollection<MonthlyCloseCompositionAreaDto?>? Areas);
