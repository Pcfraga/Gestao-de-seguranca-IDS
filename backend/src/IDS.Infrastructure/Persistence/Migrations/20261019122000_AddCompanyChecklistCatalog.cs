using IDS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations;

[Migration("20261019122000_AddCompanyChecklistCatalog")]
public partial class AddCompanyChecklistCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "TenantId",
            table: "observation_categories",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "TenantId",
            table: "checklist_items",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_observation_categories_TenantId",
            table: "observation_categories",
            column: "TenantId");

        migrationBuilder.CreateIndex(
            name: "IX_checklist_items_TenantId",
            table: "checklist_items",
            column: "TenantId");

        migrationBuilder.AddForeignKey(
            name: "FK_observation_categories_tenants_TenantId",
            table: "observation_categories",
            column: "TenantId",
            principalTable: "tenants",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_checklist_items_tenants_TenantId",
            table: "checklist_items",
            column: "TenantId",
            principalTable: "tenants",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_observation_categories_tenants_TenantId",
            table: "observation_categories");

        migrationBuilder.DropForeignKey(
            name: "FK_checklist_items_tenants_TenantId",
            table: "checklist_items");

        migrationBuilder.DropIndex(
            name: "IX_observation_categories_TenantId",
            table: "observation_categories");

        migrationBuilder.DropIndex(
            name: "IX_checklist_items_TenantId",
            table: "checklist_items");

        migrationBuilder.DropColumn(
            name: "TenantId",
            table: "observation_categories");

        migrationBuilder.DropColumn(
            name: "TenantId",
            table: "checklist_items");
    }
}
