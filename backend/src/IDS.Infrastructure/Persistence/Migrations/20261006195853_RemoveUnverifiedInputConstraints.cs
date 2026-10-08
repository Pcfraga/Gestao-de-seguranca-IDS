using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IDS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnverifiedInputConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_evaluations_observed_people_nonnegative",
                table: "evaluations");

            migrationBuilder.DropCheckConstraint(
                name: "ck_evaluation_observations_quantity_nonnegative",
                table: "evaluation_observations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_evaluations_observed_people_nonnegative",
                table: "evaluations",
                sql: "\"ObservedPeople\" IS NULL OR \"ObservedPeople\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "ck_evaluation_observations_quantity_nonnegative",
                table: "evaluation_observations",
                sql: "\"Quantity\" IS NULL OR \"Quantity\" >= 0");
        }
    }
}
