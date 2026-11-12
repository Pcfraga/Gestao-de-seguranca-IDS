using System.ComponentModel.DataAnnotations;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IDS.Api.Controllers;

public sealed record InspectionIslandDto(Guid Id, string Name, bool IsActive);

public sealed record SaveInspectionIslandRequest([Required, StringLength(200)] string Name);

[ApiController]
[Route("api/inspection-islands")]
public sealed class InspectionIslandsController(IdsDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<InspectionIslandDto>>> List(CancellationToken cancellationToken)
    {
        return Ok(await dbContext.InspectionIslands.AsNoTracking()
            .OrderBy(island => island.Name)
            .Select(island => new InspectionIslandDto(island.Id, island.Name, island.IsActive))
            .ToArrayAsync(cancellationToken));
    }

    [HttpPost]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<IActionResult> Create(SaveInspectionIslandRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Informe o nome da ilha." });
        if (await NameExists(name, null, cancellationToken))
            return Conflict(new { message = "Já existe uma ilha com este nome." });

        var island = new InspectionIsland { Name = name };
        dbContext.InspectionIslands.Add(island);
        if (!await Save(cancellationToken))
            return Conflict(new { message = "Já existe uma ilha com este nome." });
        return Created("/api/inspection-islands", new InspectionIslandDto(island.Id, island.Name, island.IsActive));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<IActionResult> Rename(Guid id, SaveInspectionIslandRequest request, CancellationToken cancellationToken)
    {
        var island = await dbContext.InspectionIslands.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (island is null) return NotFound();
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Informe o nome da ilha." });
        if (await NameExists(name, id, cancellationToken))
            return Conflict(new { message = "Já existe uma ilha com este nome." });
        island.Name = name;
        if (!await Save(cancellationToken))
            return Conflict(new { message = "Já existe uma ilha com este nome." });
        return Ok(new InspectionIslandDto(island.Id, island.Name, island.IsActive));
    }

    [HttpPut("{id:guid}/active")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public async Task<IActionResult> SetActive(Guid id, SetInspectionIslandActiveRequest request, CancellationToken cancellationToken)
    {
        if (!request.IsActive.HasValue) return BadRequest(new { message = "Informe a situação da ilha." });
        var island = await dbContext.InspectionIslands.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (island is null) return NotFound();
        island.IsActive = request.IsActive.Value;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new InspectionIslandDto(island.Id, island.Name, island.IsActive));
    }

    private Task<bool> NameExists(string name, Guid? except, CancellationToken cancellationToken) =>
        dbContext.InspectionIslands.AnyAsync(island => island.Id != except && island.Name.ToUpper() == name.ToUpper(), cancellationToken);

    private async Task<bool> Save(CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return false;
        }
    }
}

public sealed record SetInspectionIslandActiveRequest(bool? IsActive);
