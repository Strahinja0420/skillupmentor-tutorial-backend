import { Column, Entity, JoinTable, ManyToMany } from 'typeorm'

import { Base } from './base.entity'

@Entity()
export class Permission extends Base {
  @Column()
  name: string

  // if we delete a row in ManyToMany table will delete all roles inside that table
  @ManyToMany(() => Permission, { cascade: true })
  @JoinTable({
    name: 'role_permission',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[]
}
