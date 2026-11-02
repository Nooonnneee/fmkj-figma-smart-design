import { relId } from '@/lib/access'
import { getProjectOwnerOptions } from '@/lib/cached-data'

import { ProjectForm } from '../project-form'
import { DeleteProject } from './delete-project'
import { getProject, getProjectDeals } from './project-data'

/** 项目信息页：只保留客户、地址、方案配置表单与删除操作。 */
export default async function ProjectInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ project, role, readOnly }, deals] = await Promise.all([getProject(id), getProjectDeals(id)])
  const pid = String(project.id)
  const ownerOptions = role === 'owner' ? await getProjectOwnerOptions(project as never) : undefined

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <ProjectForm
        owners={ownerOptions}
        readOnly={readOnly}
        initial={{
          id: pid,
          name: project.name,
          customerName: project.customerName,
          customerPhone: project.customerPhone,
          community: project.community,
          address: project.address,
          platform: project.platform,
          budget: project.budget,
          notes: project.notes,
          owner: relId(project.owner),
        }}
      />
      {role === 'owner' ? <DeleteProject projectId={pid} projectName={project.name} quoteCount={deals.quotes.length} /> : null}
    </div>
  )
}
