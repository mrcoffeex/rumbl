import { describe, expect, it } from "vitest";
import {
  calculateCapacity,
  generateGroups,
  type GroupableStudent,
  type RoleConfig,
} from "../src/lib/grouping";

const roles: RoleConfig[] = [
  { id: 1, name: "Facilitator", slotsPerGroup: 1 },
  { id: 2, name: "Reporter", slotsPerGroup: 1 },
  { id: 3, name: "Researcher", slotsPerGroup: 1 },
];

describe("calculateCapacity", () => {
  it("allocates 40 seats across thirteen 1/1/1 base groups", () => {
    const plan = calculateCapacity(40, roles);

    expect(plan.baseGroupCount).toBe(13);
    expect(plan.totalSlotsPerGroup).toBe(3);
    expect(plan.roles.map((role) => role.capacity)).toEqual([14, 13, 13]);
    expect(plan.roles.reduce((sum, role) => sum + (role.capacity ?? 0), 0)).toBe(40);
  });

  it("leaves seats open when there is no participant limit", () => {
    const plan = calculateCapacity(null, roles);

    expect(plan.totalCapacity).toBeNull();
    expect(plan.roles.every((role) => role.capacity === null)).toBe(true);
  });

  it("distributes remainder seats according to weighted role slots", () => {
    const plan = calculateCapacity(17, [
      { id: 1, name: "Builder", slotsPerGroup: 2 },
      { id: 2, name: "Reviewer", slotsPerGroup: 1 },
    ]);

    expect(plan.baseGroupCount).toBe(5);
    expect(plan.roles.map((role) => role.capacity)).toEqual([12, 5]);
  });
});

describe("generateGroups", () => {
  it("preserves all students and role requirements for 40x3", () => {
    const capacities = calculateCapacity(40, roles).roles;
    const students: GroupableStudent[] = capacities.flatMap((role) =>
      Array.from({ length: role.capacity ?? 0 }, (_, index) => ({
        id: role.id * 100 + index,
        name: `${role.name} ${index}`,
        roleId: role.id,
      })),
    );

    const groups = generateGroups(40, roles, students, () => 0.42);
    const members = groups.flatMap((group) => group.members);

    expect(groups).toHaveLength(14);
    expect(members).toHaveLength(40);
    expect(new Set(members.map((student) => student.id)).size).toBe(40);
    expect(groups.map((group) => group.members.length).sort()).toEqual([
      1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ]);
    for (const group of groups) {
      expect(group.members.length).toBeLessThanOrEqual(3);
      for (const role of roles) {
        expect(group.members.filter((member) => member.roleId === role.id).length)
          .toBeLessThanOrEqual(role.slotsPerGroup);
      }
    }
  });

  it("keeps partial registrations unique and balanced by role", () => {
    const students = [
      ...Array.from({ length: 9 }, (_, id) => ({ id, name: `A${id}`, roleId: 1 })),
      ...Array.from({ length: 6 }, (_, id) => ({ id: id + 20, name: `B${id}`, roleId: 2 })),
      ...Array.from({ length: 3 }, (_, id) => ({ id: id + 40, name: `C${id}`, roleId: 3 })),
    ];
    const groups = generateGroups(students.length, roles, students, () => 0.25);
    const members = groups.flatMap((group) => group.members);

    expect(groups).toHaveLength(9);
    expect(new Set(members.map((student) => student.id)).size).toBe(students.length);
    expect(Math.max(...groups.map((group) => group.members.length))).toBeLessThanOrEqual(3);
    for (const role of roles) {
      const counts = groups.map(
        (group) => group.members.filter((member) => member.roleId === role.id).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it("creates one group when enrollment closes below a full group", () => {
    const students = [
      { id: 1, name: "A", roleId: 1 },
      { id: 2, name: "B", roleId: 2 },
    ];

    const groups = generateGroups(students.length, roles, students, () => 0.5);

    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});
