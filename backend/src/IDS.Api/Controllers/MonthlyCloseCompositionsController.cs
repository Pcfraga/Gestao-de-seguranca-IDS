using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IDS.Api.Controllers;

[ApiController]
[Route("api/monthly-close-compositions")]
public sealed class MonthlyCloseCompositionsController(
    IdsDbContext dbContext,
    ICurrentUserScope userScope) : ControllerBase
{
    [HttpGet("{siteId:guid}")]
    [ProducesResponseType<MonthlyCloseCompositionDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MonthlyCloseCompositionDto>> Get(
        Guid siteId,
        CancellationToken cancellationToken)
    {
        var composition = await dbContext.MonthlyCloseCompositions
            .AsNoTracking()
            .Include(value => value.Areas)
            .SingleOrDefaultAsync(value => value.SiteId == siteId, cancellationToken);
        return composition is null ? NotFound() : Ok(ToDto(composition));
    }

    [HttpPut("{siteId:guid}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<ActionResult<MonthlyCloseCompositionDto>> Put(
        Guid siteId,
        MonthlyCloseCompositionRequest? request,
        CancellationToken cancellationToken)
    {
        if (!await dbContext.Sites.AnyAsync(site => site.Id == siteId, cancellationToken))
            return NotFound();

        var areas = request?.Areas?
            .Where(area => area is not null)
            .Select(area => area!)
            .ToArray();
        if (areas is null || areas.Length is < 1 or > 4
            || areas.Any(area => area.Weight is < 0 or > 100)
            || areas.Sum(area => area.Weight) != 100m
            || areas.Select(area => area.AreaId).Distinct().Count() != areas.Length
            || areas.Count(area => area.Weight > 0) is < 1 or > 4)
            return BadRequest(new { message = "Selecione de 1 a 4 áreas distintas, com pesos entre 0 e 100 e soma igual a 100." });

        var areaIds = areas.Select(area => area.AreaId).ToArray();
        var persistedAreaIds = areaIds.Where(id => id != Guid.Empty).ToArray();
        if (await dbContext.InspectionAreas.CountAsync(area => persistedAreaIds.Contains(area.Id), cancellationToken) != persistedAreaIds.Length)
            return BadRequest(new { message = "Área de inspeção não encontrada para esta empresa." });

        var composition = await dbContext.MonthlyCloseCompositions
            .Include(value => value.Areas)
            .SingleOrDefaultAsync(value => value.SiteId == siteId, cancellationToken);
        if (composition is null)
        {
            composition = new MonthlyCloseComposition
            {
                SiteId = siteId,
                CreatedByUserId = userScope.UserId
            };
            dbContext.MonthlyCloseCompositions.Add(composition);
        }
        else
        {
            dbContext.MonthlyCloseCompositionAreas.RemoveRange(composition.Areas);
        }

        composition.Areas = areas.Select(area => new MonthlyCloseCompositionArea
        {
            AreaId = area.AreaId,
            Weight = area.Weight,
            CreatedByUserId = userScope.UserId,
            UpdatedByUserId = userScope.UserId
        }).ToArray();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(composition));
    }

    private static MonthlyCloseCompositionDto ToDto(MonthlyCloseComposition composition) =>
        new(composition.SiteId, composition.Areas
            .Select(area => new MonthlyCloseCompositionAreaDto(area.AreaId, area.Weight))
            .ToArray());
}

public sealed record MonthlyCloseCompositionAreaDto(Guid AreaId, decimal Weight);
public sealed record MonthlyCloseCompositionDto(Guid SiteId, IReadOnlyCollection<MonthlyCloseCompositionAreaDto> Areas);
public sealed record MonthlyCloseCompositionRequest(IReadOnlyCollection<MonthlyCloseCompositionAreaDto?>? Areas);
