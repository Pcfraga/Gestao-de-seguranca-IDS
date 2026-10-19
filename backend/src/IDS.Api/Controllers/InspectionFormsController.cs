using System.ComponentModel.DataAnnotations;
using IDS.Domain.Entities;
using IDS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IDS.Api.Controllers;

public sealed record InspectionFormItemRequest([Required, StringLength(200)] string Name);

public sealed record InspectionFormTopicRequest(
    [Required, StringLength(150)] string Name,
    [Required, MinLength(1)] IReadOnlyList<InspectionFormItemRequest> Items);

public sealed record SaveInspectionFormRequest(
    [Required, StringLength(150)] string Name,
    [Required, MinLength(1)] IReadOnlyList<InspectionFormTopicRequest> Categories,
    [Range(0, int.MaxValue)] int ExpectedVersion,
    Guid? AreaId = null);

public sealed record InspectionFormItemDto(Guid Id, string Name);

public sealed record InspectionFormTopicDto(Guid Id, string Name, IReadOnlyCollection<InspectionFormItemDto> Items);

public sealed record InspectionFormDto(
    Guid Id,
    Guid? VersionId,
    int Version,
    string Name,
    bool IsDefault,
    IReadOnlyCollection<InspectionFormTopicDto> Categories,
    Guid AreaId = default,
    string AreaName = InspectionArea.DefaultName);

[ApiController]
[Route("api/inspection-forms")]
public sealed class InspectionFormsController(IdsDbContext dbContext, ICurrentUserScope userScope) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<InspectionFormDto>>> List(CancellationToken cancellationToken)
    {
        var versions = await dbContext.InspectionFormVersions.AsNoTracking()
            .Include(version => version.Form)
            .Include(version => version.Categories).ThenInclude(category => category.Items)
            .Where(version => version.Version == version.Form.CurrentVersion)
            .OrderByDescending(version => version.Form.IsDefault).ThenBy(version => version.Name)
            .ToArrayAsync(cancellationToken);
        var forms = versions.Select(ToDto).ToList();
        if (!versions.Any(version => version.Form.IsDefault))
        {
            var categories = await dbContext.ObservationCategories.AsNoTracking()
                .Include(category => category.Items)
                .Where(category => category.FormVersionId == null)
                .OrderBy(category => category.SortOrder).ToArrayAsync(cancellationToken);
            forms.Insert(0, new InspectionFormDto(
                Guid.Empty, null, 0, "Formulário padrão", true, Topics(categories)));
        }

        return Ok(forms);
    }

    [Authorize(Roles = "ADMINISTRADOR")]
    [HttpPost]
    public Task<IActionResult> Create(SaveInspectionFormRequest request, CancellationToken cancellationToken) =>
        Save(null, request, cancellationToken);

    [Authorize(Roles = "ADMINISTRADOR")]
    [HttpPut("{id:guid}")]
    public Task<IActionResult> Update(Guid id, SaveInspectionFormRequest request, CancellationToken cancellationToken) =>
        Save(id, request, cancellationToken);

    private async Task<IActionResult> Save(Guid? id, SaveInspectionFormRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)
            || request.Categories.Any(category => category is null || string.IsNullOrWhiteSpace(category.Name)
                || category.Items.Any(item => item is null || string.IsNullOrWhiteSpace(item.Name))))
        {
            return BadRequest(new { message = "Informe o nome do formulário, de todos os tópicos e de seus itens." });
        }

        InspectionForm form;
        var areaId = request.AreaId is Guid value && value != Guid.Empty ? value : (Guid?)null;
        var area = areaId.HasValue
            ? await dbContext.InspectionAreas.SingleOrDefaultAsync(value => value.Id == areaId, cancellationToken)
            : null;
        if (areaId.HasValue && area is null)
            return BadRequest(new { message = "Área não encontrada para esta empresa." });

        if (id == Guid.Empty)
        {
            if (await dbContext.InspectionForms.AnyAsync(value => value.IsDefault, cancellationToken))
            {
                return Conflict(new { message = "O formulário padrão foi atualizado. Recarregue a lista antes de editar." });
            }

            form = new InspectionForm { IsDefault = true };
            dbContext.InspectionForms.Add(form);
        }
        else if (id is Guid formId)
        {
            var existing = await dbContext.InspectionForms.SingleOrDefaultAsync(value => value.Id == formId, cancellationToken);
            if (existing is null) return NotFound();
            form = existing;
            var previousArea = await dbContext.InspectionFormVersions
                .Where(version => version.FormId == formId && version.Version == form.CurrentVersion)
                .Select(version => version.AreaId).SingleAsync(cancellationToken);
            if (previousArea != areaId)
                return BadRequest(new { message = "A área de um formulário salvo não pode ser trocada. Duplique-o na nova área para preservar a separação do histórico." });
        }
        else
        {
            form = new InspectionForm();
            dbContext.InspectionForms.Add(form);
        }

        if (request.ExpectedVersion != form.CurrentVersion)
        {
            return Conflict(new { message = "Este formulário foi editado por outra pessoa. Recarregue a lista antes de salvar." });
        }

        if (form.IsDefault && areaId.HasValue)
            return BadRequest(new { message = "O formulário padrão pertence a Saúde e Segurança do Trabalho. Duplique-o para outra área." });

        form.CurrentVersion++;
        var revision = new InspectionFormVersion
        {
            Form = form,
            FormId = form.Id,
            Version = form.CurrentVersion,
            Name = request.Name.Trim(),
            AreaId = areaId,
            AreaName = area?.Name ?? InspectionArea.DefaultName,
            CreatedByUserId = userScope.UserId
        };
        for (var categoryIndex = 0; categoryIndex < request.Categories.Count; categoryIndex++)
        {
            var input = request.Categories[categoryIndex];
            var category = new ObservationCategory
            {
                FormVersion = revision,
                FormVersionId = revision.Id,
                Code = $"form-{Guid.NewGuid():N}",
                Name = input.Name.Trim(),
                SortOrder = categoryIndex + 1
            };
            for (var itemIndex = 0; itemIndex < input.Items.Count; itemIndex++)
            {
                category.Items.Add(new ChecklistItem
                {
                    Category = category,
                    CategoryId = category.Id,
                    Code = $"form-{Guid.NewGuid():N}",
                    Name = input.Items[itemIndex].Name.Trim(),
                    SortOrder = itemIndex + 1
                });
            }

            revision.Categories.Add(category);
        }

        dbContext.InspectionFormVersions.Add(revision);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Este formulário foi editado por outra pessoa. Recarregue a lista antes de salvar." });
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Conflict(new { message = "Uma nova versão deste formulário já foi salva. Recarregue a lista antes de salvar." });
        }

        return id.HasValue ? Ok(ToDto(revision)) : Created("/api/inspection-forms", ToDto(revision));
    }

    private static InspectionFormDto ToDto(InspectionFormVersion version) =>
        new(version.FormId, version.Id, version.Version, version.Name, version.Form.IsDefault, Topics(version.Categories),
            version.AreaId ?? Guid.Empty, version.AreaName);

    private static InspectionFormTopicDto[] Topics(IEnumerable<ObservationCategory> categories) =>
        categories.OrderBy(category => category.SortOrder).Select(category => new InspectionFormTopicDto(
            category.Id, category.Name, category.Items.Where(item => item.IsActive).OrderBy(item => item.SortOrder)
                .Select(item => new InspectionFormItemDto(item.Id, item.Name)).ToArray())).ToArray();
}
