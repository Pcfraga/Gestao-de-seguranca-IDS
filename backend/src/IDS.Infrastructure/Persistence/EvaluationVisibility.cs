using IDS.Domain.Entities;

namespace IDS.Infrastructure.Persistence;

internal static class EvaluationVisibility
{
    public static IQueryable<Evaluation> VisibleTo(
        this IQueryable<Evaluation> query,
        ICurrentUserScope userScope)
    {
        var userId = userScope.UserId ?? "-";
        return userScope.IsAdministrator
            ? query.Where(evaluation =>
                evaluation.Status == EvaluationStatus.Submitted
                || evaluation.CreatedByUserId == userId
                || evaluation.CreatedByUserId == null)
            : query.Where(evaluation => evaluation.CreatedByUserId == userId);
    }

    public static IQueryable<Evaluation> Submitted(
        this IQueryable<Evaluation> query) =>
        query.Where(evaluation => evaluation.Status == EvaluationStatus.Submitted);
}
