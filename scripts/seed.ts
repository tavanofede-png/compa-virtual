import {writeFile} from 'node:fs/promises';
import {methods} from '../packages/domain/src/index';
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
await writeFile('supabase/seed.sql','-- Generated from the versioned pedagogy catalogue. No student data.\n'+methods.map(m=>'insert into public.learning_methods(id,data) values('+quote(m.id)+','+quote(JSON.stringify(m))+'::jsonb) on conflict(id) do update set data=excluded.data;').join('\n')+'\n');
