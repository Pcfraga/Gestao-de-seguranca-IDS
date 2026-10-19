using System.ComponentModel.DataAnnotations;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IDS.Api.Controllers;

public sealed record InspectionAreaDto(Guid Id, string Name);

public sealed record SaveInspectionAreaRequest([Required, StringLength(150)] string Name);

[ApiController]
[Route("api/inspection-areas")]
public sealed class InspectionAreasController(IdsDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<InspectionAreaDto>>> List(CancellationToken cancellationToken)
    {
        var areas = await dbContext.InspectionAreas.AsNoTracking().OrderBy(area => area.Name)
            .Select(area => new InspectionAreaDto(area.Id, area.Name)).ToListAsync(cancellationToken);
        areas.Insert(0, new InspectionAreaDto(Guid.Empty, InspectionArea.DefaultName));
        return Ok(areas);
    }

    [HttpPost]
    [Authorize(Roles = "ADMINISTRADOR")]
    public async Task<IActionResult> Create(SaveInspectionAreaRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Informe o nome da área." });

        var name = request.Name.Trim();
        if (string.Equals(name, InspectionArea.DefaultName, StringComparison.OrdinalIgnoreCase)
            || await dbContext.InspectionAreas.AnyAsync(area => area.Name.ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe uma área com este nome." });

        var area = new InspectionArea { Name = name };
        dbContext.InspectionAreas.Add(area);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Conflict(new { message = "Já existe uma área com este nome." });
        }
        return Created("/api/inspection-areas", new InspectionAreaDto(area.Id, area.Name));
    }
}
