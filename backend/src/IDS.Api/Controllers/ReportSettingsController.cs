using System.Text.RegularExpressions;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IDS.Api.Controllers;

[ApiController]
[Route("api/settings/report")]
public sealed partial class ReportSettingsController(IdsDbContext dbContext, ICurrentUserScope userScope) : ControllerBase
{
    private const int MaxLogoLength = 400_000;

    [HttpGet]
    public async Task<ActionResult<ReportSettingsDto>> Get(CancellationToken cancellationToken)
    {
        var settings = await dbContext.ReportSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        return Ok(settings is null
            ? new ReportSettingsDto("", "", null, "#173e2e")
            : new ReportSettingsDto(settings.CompanyName, settings.Tagline, settings.LogoDataUrl, settings.PrimaryColor));
    }

    [HttpPut]
    [Authorize(Roles = "ADMINISTRADOR")]
    public async Task<ActionResult<ReportSettingsDto>> Put(ReportSettingsDto request, CancellationToken cancellationToken)
    {
        var company = request.CompanyName?.Trim() ?? string.Empty;
        var tagline = request.Tagline?.Trim() ?? string.Empty;
        if (company.Length is 0 or > 120 || tagline.Length > 160)
        {
            return BadRequest(new { message = "Informe o nome da empresa (até 120 caracteres) e slogan de até 160." });
        }

        if (!HexColor().IsMatch(request.PrimaryColor ?? string.Empty))
        {
            return BadRequest(new { message = "Cor inválida. Use o formato #RRGGBB." });
        }

        var logo = string.IsNullOrWhiteSpace(request.LogoDataUrl) ? null : request.LogoDataUrl;
        if (logo is not null && (!logo.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) || logo.Length > MaxLogoLength))
        {
            return BadRequest(new { message = "Logo inválido ou muito grande." });
        }

        var settings = await dbContext.ReportSettings.FirstOrDefaultAsync(cancellationToken);
        if (settings is null)
        {
            settings = new ReportSettings { CreatedByUserId = userScope.UserId };
            dbContext.ReportSettings.Add(settings);
        }

        settings.CompanyName = company;
        settings.Tagline = tagline;
        settings.LogoDataUrl = logo;
        settings.PrimaryColor = request.PrimaryColor!;
        settings.UpdatedByUserId = userScope.UserId;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ReportSettingsDto(settings.CompanyName, settings.Tagline, settings.LogoDataUrl, settings.PrimaryColor));
    }

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();
}

public sealed record ReportSettingsDto(string CompanyName, string Tagline, string? LogoDataUrl, string PrimaryColor);
