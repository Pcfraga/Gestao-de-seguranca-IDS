using IDS.Application.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IDS.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/reports/ipf-composition")]
public sealed class IpfCompositionController(IpfCompositionApplicationService service) : ControllerBase
{
    [HttpGet("{year:int}")]
    public Task<IActionResult> GetYear(int year, [FromQuery] Guid contractorId, CancellationToken cancellationToken) =>
        Execute(async () => await service.GetYearAsync(year, contractorId, cancellationToken));

    [HttpPost("{year:int}/{month:int}/preview")]
    public Task<IActionResult> Preview(int year, int month, IpfCompositionRequest? request, CancellationToken cancellationToken) =>
        Execute(async () => await service.PreviewAsync(year, month, request, cancellationToken));

    [HttpPut("{year:int}/{month:int}")]
    [Authorize(Roles = "ADMINISTRADOR,GESTOR")]
    public Task<IActionResult> Save(int year, int month, IpfCompositionRequest? request, CancellationToken cancellationToken) =>
        Execute(async () => await service.SaveAsync(year, month, request, cancellationToken));

    private async Task<IActionResult> Execute(Func<Task<object>> action)
    {
        try { return Ok(await action()); }
        catch (IpfReportValidationException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(
                new Dictionary<string, string[]> { ["composition"] = exception.Errors.ToArray() }));
        }
    }
}
