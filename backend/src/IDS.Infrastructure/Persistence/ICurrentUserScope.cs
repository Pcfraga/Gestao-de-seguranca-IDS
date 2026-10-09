namespace IDS.Infrastructure.Persistence;

public interface ICurrentUserScope
{
    Guid? TenantId { get; }

    string? UserId { get; }

    bool IsAdministrator { get; }
}
