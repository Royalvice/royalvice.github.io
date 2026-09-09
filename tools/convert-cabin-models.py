"""Convert the downloaded Source models; preserve source mesh and textures."""
import bpy,sys,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'artifacts/dungeon-rebuild/tooling'))
from SourceIO.blender_bindings.bindings import register
register()
from mathutils import Vector, Matrix
out=root/'public/assets/profile/dungeon-v5/models';out.mkdir(parents=True,exist_ok=True)
report=[]
for ident in ['jack','ace','taro','80']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 candidates=list((root/'artifacts/dungeon-rebuild/model-sources'/ident).rglob('*human_size.mdl'))
 mdl=next((p for p in candidates if '/sfm/' in str(p)),candidates[0])
 result=bpy.ops.sourceio.mdl(filepath=str(mdl),directory=str(mdl.parent),files=[{'name':mdl.name}],import_textures=True,import_animations=False,import_physics=False)
 print('IMPORTED',ident,result)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 print('MESHES',[(o.name,len(o.data.vertices),[m.name for m in o.data.materials]) for o in meshes])
 for arm in [o for o in bpy.context.scene.objects if o.type=='ARMATURE']:
  print('BONES',ident,[b.name for b in arm.pose.bones])
  # Analytic two-bone posing keeps limb lengths and the original skinned mesh.
  bones=arm.pose.bones
  def aim(name,child,target):
   bone=bones[name];delta=(bones[child].head-bone.head).normalized().rotation_difference((Vector(target)-bone.head).normalized());head=bone.head.copy()
   bone.matrix=Matrix.Translation(head)@delta.to_matrix().to_4x4()@Matrix.Translation(-head)@bone.matrix;bpy.context.view_layer.update()
  def ik(upper,lower,end,target,pole):
   start=bones[upper].head.copy();middle=bones[lower].head.copy();tip=bones[end].head.copy();l1=(middle-start).length;l2=(tip-middle).length
   direction=Vector(target)-start;d=min(direction.length,l1+l2-.001);axis=direction.normalized();target=start+axis*d
   plane=Vector(pole)-start;plane=(plane-axis*plane.dot(axis)).normalized();along=(l1*l1-l2*l2+d*d)/(2*d);elbow=start+axis*along+plane*math.sqrt(max(0,l1*l1-along*along))
   aim(upper,lower,elbow);aim(lower,end,target)
  headZ=bones['bip_head'].head.z;k=headZ/1.314
  def v(x,y,z):return Vector((x*k,y*k,z*k))
  # A planted, slightly asymmetric stance instead of straight parallel legs.
  pelvis=bones['bip_pelvis'];m=pelvis.matrix.copy();m.translation.z-=.07*k;pelvis.matrix=m;bpy.context.view_layer.update()
  for side,sign in [('L',1),('R',-1)]:
   footBone=bones['bip_foot_'+side];footRotation=footBone.matrix.to_3x3().to_4x4();foot=footBone.head.copy();target=Vector((sign*.20*k,(-.065 if sign>0 else .025)*k,foot.z+.07*k))
   ik('bip_hip_'+side,'bip_knee_'+side,'bip_foot_'+side,target,v(sign*.23,-.25,.43))
   footRotation.translation=footBone.head.copy();footBone.matrix=footRotation;bpy.context.view_layer.update()
  # Official signature formations: Jack cross, Ace/80 L, Taro T.
  poses={
   'jack':(v(-.025,-.27,1.32),v(-.07,-.32,1.205)),
   'ace':(v(-.095,-.29,1.31),v(-.07,-.31,1.08)),
   'taro':(v(-.025,-.27,1.22),v(-.05,-.31,1.30)),
   '80':(v(-.095,-.29,1.33),v(-.075,-.32,1.10))
  }
  right,left=poses[ident]
  ik('bip_upperArm_R','bip_lowerArm_R','bip_hand_R',right,v(-.1,-.22,.86))
  ik('bip_upperArm_L','bip_lowerArm_L','bip_hand_L',left,v(.43,-.21,left.z/k))
  for side,direction in [('R',Vector((0,0,1))),('L',Vector((-1,0,0)))]:
   hand=bones['bip_hand_'+side];middle=bones['bip_middle_1_'+side];head=hand.head.copy();delta=(middle.head-head).normalized().rotation_difference(direction)
   hand.matrix=Matrix.Translation(head)@delta.to_matrix().to_4x4()@Matrix.Translation(-head)@hand.matrix;bpy.context.view_layer.update()
  # Bake the chosen display pose into the exported static mesh.
  for obj in meshes:
   bpy.context.view_layer.objects.active=obj
   for modifier in list(obj.modifiers):
    if modifier.type=='ARMATURE':bpy.ops.object.modifier_apply(modifier=modifier.name)
 # SourceIO creates custom shader graphs: bind original base-colour maps to glTF PBR.
 for mat in bpy.data.materials:
  if not mat.use_nodes:continue
  textures=[n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
  if not textures:continue
  image=next((i for i in textures if not any(x in i.name.lower() for x in ['normal','bump','phong','mask'])),textures[0])
  mat.node_tree.nodes.clear();output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');bsdf=mat.node_tree.nodes.new('ShaderNodeBsdfPrincipled');tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
  mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);mat.node_tree.links.new(bsdf.outputs['BSDF'],output.inputs['Surface']);bsdf.inputs['Metallic'].default_value=.18;bsdf.inputs['Roughness'].default_value=.38
  image.pack()
 bpy.ops.wm.save_as_mainfile(filepath=str(root/f'artifacts/dungeon-rebuild/model-sources/{ident}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(out/f'{ident}.glb'),export_format='GLB',export_animations=False,export_apply=True,export_yup=True)
 report.append({'id':ident,'source':str(mdl.relative_to(root)),'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'bytes':(out/f'{ident}.glb').stat().st_size,'pose':{'jack':'Spacium Beam','ace':'Metalium Beam','taro':'Strium Beam','80':'Succium Beam'}[ident],'poseReference':'https://tsuburaya-prod.com/heroes/ultraman-'+ident})
(root/'artifacts/dungeon-rebuild/model-conversion.json').write_text(json.dumps(report,indent=2))
