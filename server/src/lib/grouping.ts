export type RoleConfig = {
  id: number;
  name: string;
  slotsPerGroup: number;
};

export type GroupableStudent = {
  id: number;
  name: string;
  roleId: number;
};

export type RoleCapacity = RoleConfig & { capacity: number | null };

export type CapacityPlan = {
  baseGroupCount: number;
  totalSlotsPerGroup: number;
  totalCapacity: number | null;
  roles: RoleCapacity[];
};

export type GroupResult = {
  position: number;
  name: string;
  members: GroupableStudent[];
};

export function calculateCapacity(
  expectedStudentCount: number | null,
  roles: RoleConfig[],
): CapacityPlan {
  if (
    roles.length === 0 ||
    roles.some((role) => !Number.isInteger(role.slotsPerGroup) || role.slotsPerGroup < 1)
  ) {
    throw new Error("At least one role with positive integer slots is required");
  }

  const totalSlotsPerGroup = roles.reduce((sum, role) => sum + role.slotsPerGroup, 0);
  if (expectedStudentCount == null) {
    return {
      baseGroupCount: 0,
      totalSlotsPerGroup,
      totalCapacity: null,
      roles: roles.map((role) => ({ ...role, capacity: null })),
    };
  }
  if (!Number.isInteger(expectedStudentCount) || expectedStudentCount < 1) {
    throw new Error("Expected student count must be a positive integer");
  }
  const baseGroupCount = Math.floor(expectedStudentCount / totalSlotsPerGroup);
  const capacities = new Map(
    roles.map((role) => [role.id, baseGroupCount * role.slotsPerGroup]),
  );
  const seatCycle = roles.flatMap((role) =>
    Array.from({ length: role.slotsPerGroup }, () => role.id),
  );
  const remainder = expectedStudentCount - baseGroupCount * totalSlotsPerGroup;

  for (let index = 0; index < remainder; index += 1) {
    const roleId = seatCycle[index];
    capacities.set(roleId, (capacities.get(roleId) ?? 0) + 1);
  }

  return {
    baseGroupCount,
    totalSlotsPerGroup,
    totalCapacity: expectedStudentCount,
    roles: roles.map((role) => ({ ...role, capacity: capacities.get(role.id) ?? 0 })),
  };
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function generateGroups(
  studentCount: number,
  roles: RoleConfig[],
  students: GroupableStudent[],
  random: () => number = Math.random,
): GroupResult[] {
  if (studentCount !== students.length || studentCount < 1) {
    throw new Error("Student count must match a non-empty student list");
  }
  const plan = calculateCapacity(studentCount, roles);

  const roleIds = new Set(roles.map((role) => role.id));
  if (students.some((student) => !roleIds.has(student.roleId))) {
    throw new Error("Every student must reference a configured role");
  }
  const groupCount = Math.max(
    Math.ceil(studentCount / plan.totalSlotsPerGroup),
    ...roles.map((role) =>
      Math.ceil(
        students.filter((student) => student.roleId === role.id).length /
          role.slotsPerGroup,
      ),
    ),
  );

  const groups: GroupResult[] = Array.from(
    { length: groupCount },
    (_, index) => ({
      position: index + 1,
      name: `Group ${index + 1}`,
      members: [],
    }),
  );

  for (const role of roles) {
    const assigned = shuffle(
      students.filter((student) => student.roleId === role.id),
      random,
    );

    let cursor = 0;
    for (let slot = 0; slot < role.slotsPerGroup; slot += 1) {
      for (const group of groups) {
        if (cursor < assigned.length) group.members.push(assigned[cursor++]);
      }
    }
  }

  return groups;
}
