using System.ComponentModel.DataAnnotations;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IDS.Api.Controllers;

public sealed record InspectionAreaDto(Guid Id, string Name, bool IsActive = true);

public sealed record SaveInspectionAreaRequest([Required, StringLength(150)] string Name);

[ApiController]
[Route("api/inspection-areas")]
public sealed class InspectionAreasController(IdsDbContext dbContext, ICurrentUserScope userScope) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<InspectionAreaDto>>> List(CancellationToken cancellationToken)
    {
        var areas = await dbContext.InspectionAreas.AsNoTracking().OrderBy(area => area.Name)
            .Select(area => new InspectionAreaDto(area.Id, area.Name, area.IsActive)).ToListAsync(cancellationToken);
        var defaultName = await dbContext.Tenants.Where(tenant => tenant.Id == userScope.TenantId)
            .Select(tenant => tenant.DefaultAreaName).SingleAsync(cancellationToken);
        areas.Insert(0, new InspectionAreaDto(Guid.Empty, defaultName));
        return Ok(areas);
    }

    [HttpPost]
    [Authorize(Roles = "ADMINISTRADOR")]
    public async Task<IActionResult> Create(SaveInspectionAreaRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Informe o nome da área." });

        var name = request.Name.Trim();
        var defaultName = await dbContext.Tenants.Where(tenant => tenant.Id == userScope.TenantId)
            .Select(tenant => tenant.DefaultAreaName).SingleAsync(cancellationToken);
        if (string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase)
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

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "ADMINISTRADOR")]
    public async Task<IActionResult> Rename(Guid id, SaveInspectionAreaRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (name.Length == 0) return BadRequest(new { message = "Informe o nome da área." });
        var tenant = await dbContext.Tenants.SingleAsync(value => value.Id == userScope.TenantId, cancellationToken);
        if ((id != Guid.Empty && string.Equals(name, tenant.DefaultAreaName, StringComparison.OrdinalIgnoreCase))
            || await dbContext.InspectionAreas.AnyAsync(area => area.Id != id && area.Name.ToUpper() == name.ToUpper(), cancellationToken))
            return Conflict(new { message = "Já existe uma área com este nome." });
        InspectionArea? area = null;
        if (id == Guid.Empty) tenant.DefaultAreaName = name;
        else
        {
            area = await dbContext.InspectionAreas.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
            if (area is null) return NotFound();
            area.Name = name;
        }
        var areaId = id == Guid.Empty ? (Guid?)null : id;
        var versions = await dbContext.InspectionFormVersions.Where(version => version.AreaId == areaId).ToArrayAsync(cancellationToken);
        foreach (var version in versions) version.AreaName = name;
        var compositions = await dbContext.IpfCompositionAreas.Where(value => value.AreaId == id).ToArrayAsync(cancellationToken);
        foreach (var composition in compositions) composition.AreaName = name;
        try { await dbContext.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return Conflict(new { message = "Já existe uma área com este nome." }); }
        return Ok(new InspectionAreaDto(id, name, area?.IsActive ?? true));
    }

    [HttpPut("{id:guid}/active")]
    [Authorize(Roles = "ADMINISTRADOR")]
    public async Task<IActionResult> SetActive(Guid id, SetInspectionIslandActiveRequest request, CancellationToken cancellationToken)
    {
        if (!request.IsActive.HasValue) return BadRequest(new { message = "Informe a situação da área." });
        if (id == Guid.Empty) return BadRequest(new { message = "A área padrão não pode ser desativada." });
        var area = await dbContext.InspectionAreas.SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (area is null) return NotFound();
        area.IsActive = request.IsActive.Value;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new InspectionAreaDto(area.Id, area.Name, area.IsActive));
    }
}
