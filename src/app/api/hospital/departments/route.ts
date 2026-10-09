import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_DEPARTMENTS, Department } from '@/lib/hospital/departments';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';

let runtimeDepartments: Department[] = [...DEFAULT_DEPARTMENTS];

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      departments: runtimeDepartments,
      totalCount: runtimeDepartments.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole('staff');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient role to manage departments.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (body.action === 'reset') {
      runtimeDepartments = [...DEFAULT_DEPARTMENTS];
      return NextResponse.json({
        success: true,
        message: 'Departments reset to default successfully.',
        departments: runtimeDepartments,
      });
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const newDept: Department = {
      id: body.id || `dept-${Date.now()}`,
      name: body.name.trim(),
      description: body.description?.trim() || '',
      leadSpecialist: body.leadSpecialist?.trim() || 'Dr. Mrinalini',
      isActive: body.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    runtimeDepartments.push(newDept);

    return NextResponse.json({
      success: true,
      message: `Department "${newDept.name}" created successfully.`,
      department: newDept,
      departments: runtimeDepartments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireRole('staff');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient role to update departments.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    if (Array.isArray(body.departments)) {
      runtimeDepartments = body.departments;
      return NextResponse.json({
        success: true,
        message: 'Departments list updated successfully.',
        departments: runtimeDepartments,
      });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    const index = runtimeDepartments.findIndex(d => d.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    runtimeDepartments[index] = {
      ...runtimeDepartments[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `Department "${runtimeDepartments[index].name}" updated successfully.`,
      department: runtimeDepartments[index],
      departments: runtimeDepartments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireRole('staff');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient role to delete departments.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    const existing = runtimeDepartments.find(d => d.id === id);
    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    runtimeDepartments = runtimeDepartments.filter(d => d.id !== id);

    return NextResponse.json({
      success: true,
      message: `Department "${existing.name}" deleted successfully.`,
      departments: runtimeDepartments,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
