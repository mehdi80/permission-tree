import { PermissionNodeDto } from '../domain/permission.model';

export const MOCK_PERMISSIONS = [
  {
    id: 1,
    title: 'HR',
    selected: false,
    children: [
      {
        id: 2,
        title: 'Employees',
        selected: false,
        children: [
          {
            id: 3,
            title: 'Create Employee',
            selected: false,
          },
          {
            id: 4,
            title: 'Edit Employee',
            selected: false,
          },
          {
            id: 5,
            title: 'Delete Employee',
            selected: false,
          },
        ],
      },
      {
        id: 6,
        title: 'Reports',
        selected: false,
        children: [
          {
            id: 7,
            title: 'Salary Report',
            selected: false,
          },
          {
            id: 8,
            title: 'Attendance Report',
            selected: false,
          },
        ],
      },
    ],
  },
] satisfies readonly PermissionNodeDto[];
