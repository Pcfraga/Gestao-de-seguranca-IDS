namespace IDS.Infrastructure.Persistence;

public interface ICurrentUserScope
{
    string? UserId { get; }

    bool IsAdministrator { get; }
}
