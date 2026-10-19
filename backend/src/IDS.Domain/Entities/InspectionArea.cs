namespace IDS.Domain.Entities;

public sealed class InspectionArea : TenantEntity
{
    public const string DefaultName = "Saúde e Segurança do Trabalho";

    public required string Name { get; set; }
}
