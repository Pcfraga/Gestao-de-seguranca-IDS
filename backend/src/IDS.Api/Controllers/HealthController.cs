using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IDS.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/health")]
public sealed class HealthController(IdsDbContext dbContext, ILogger<HealthController> logger) : ControllerBase
{
    [HttpGet("ready")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetReadiness(CancellationToken cancellationToken)
    {
        try
        {
            if (!await dbContext.Database.CanConnectAsync(cancellationToken))
{
    var connection = dbContext.Database.GetDbConnection();

    return StatusCode(StatusCodes.Status503ServiceUnavailable, new
    {
        status = "not_ready",
        database = "unavailable",
        host = connection.Host,
        port = connection.Port,
        databaseName = connection.Database,
        username = connection.UserID
    });
}

            var pendingMigrations = await dbContext.Database.GetPendingMigrationsAsync(cancellationToken);
            if (pendingMigrations.Any())
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { status = "not_ready", database = "available", schema = "migrations_pending" });
            }

            return Ok(new { status = "ready", database = "available", schema = "current" });
        }
        catch (Exception exception)
{
    logger.LogWarning(exception, "O health check não conseguiu conectar ao PostgreSQL.");

    return StatusCode(StatusCodes.Status503ServiceUnavailable, new
    {
        status = "not_ready",
        database = "unavailable",
        error = exception.Message
    });
}

return StatusCode(StatusCodes.Status503ServiceUnavailable, new
{
    status = "not_ready",
    database = "unavailable"
});
    }
}