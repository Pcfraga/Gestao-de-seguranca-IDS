namespace IDS.Domain.Entities;

public sealed class ReportSettings : AuditableEntity
{
    public string CompanyName { get; set; } = string.Empty;

    public string Tagline { get; set; } = string.Empty;

    public string? LogoDataUrl { get; set; }

    public string PrimaryColor { get; set; } = "#173e2e";
}
