"""Convert the downloaded Source models; preserve source mesh and textures."""
import bpy,sys,json,math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'artifacts/dungeon-rebuild/tooling'))
from SourceIO.blender_bindings.bindings import register
register()
from mathutils import Vector, Matrix
out=root/'public/assets/profile/ultra-poses-v2';out.mkdir(parents=True,exist_ok=True)
report=[]
pivots={}
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
  # Source coordinates: +X anatomical left, -Y forward, +Z up.
  # Each pose is traced against its own official Bandai photo, not a shared L-pose.
  headZ=bones['bip_head'].head.z;k=headZ/1.314
  drop={'jack':.075,'ace':.115,'taro':.09,'80':.035}[ident]
  def v(x,y,z):return Vector((x*k,y*k,(z-drop)*k))
  footMatrices={side:bones['bip_foot_'+side].matrix.copy() for side in ['L','R']}
  pelvis=bones['bip_pelvis'];m=pelvis.matrix.copy();m.translation.z-=drop*k;pelvis.matrix=m;bpy.context.view_layer.update()
  # Individual stances, keeping both original soles on the same plane.
  feet={
    'jack':{'L':(.18,.10),'R':(-.22,-.12)},
    'ace':{'L':(.27,.11),'R':(-.25,-.17)},
    'taro':{'L':(.26,.02),'R':(-.25,-.08)},
    '80':{'L':(.24,.025),'R':(-.22,-.035)}
  }
  for side,sign in [('L',1),('R',-1)]:
   x,y=feet[ident][side];original=footMatrices[side];target=Vector((x*k,y*k,original.translation.z))
   ik('bip_hip_'+side,'bip_knee_'+side,'bip_foot_'+side,target,v(sign*.26,-.3,.45))
   original.translation=bones['bip_foot_'+side].head.copy();bones['bip_foot_'+side].matrix=original;bpy.context.view_layer.update()
  poses={
   'jack':((- .12,-.27,1.14),(-.10,-.31,1.16),(-.23,-.20,.89),(.40,-.22,1.12)),
   'ace': ((-.26,-.29,1.18),(.20,-.19,1.10),(-.40,-.13,.99),(.39,-.05,1.01)),
   'taro':((.025,-.205,1.20),(.17,-.20,1.095),(-.33,-.13,1.22),(.36,-.12,.90)),
   '80':  ((-.55,-.045,1.20),(.20,-.05,1.62),(-.39,-.02,1.21),(.28,-.02,1.45))
  }
  right,left,rightPole,leftPole=poses[ident]
  ik('bip_upperArm_R','bip_lowerArm_R','bip_hand_R',v(*right),v(*rightPole))
  ik('bip_upperArm_L','bip_lowerArm_L','bip_hand_L',v(*left),v(*leftPole))
  def orientHand(side,direction,normal):
   hand=bones['bip_hand_'+side];head=hand.head.copy()
   d=(bones['bip_middle_0_'+side].head-head).normalized()
   across=(bones['bip_index_0_'+side].head-bones['bip_pinky_0_'+side].head).normalized()
   n=d.cross(across).normalized()*(1 if side=='L' else -1)
   def frame(d,n):
    d=d.normalized();n=(n-d*n.dot(d)).normalized();return Matrix((d,n.cross(d),n)).transposed()
   delta=frame(Vector(direction),Vector(normal))@frame(d,n).transposed()
   hand.matrix=Matrix.Translation(head)@delta.to_4x4()@Matrix.Translation(-head)@hand.matrix;bpy.context.view_layer.update()
  handDirections={
   'jack':{'R':((0,0,1),(1,0,0)),'L':((-1,0,0),(0,0,-1))},
   'ace': {'R':((0,-.25,1),(0,-1,-.25)),'L':((-.5,-.6,.55),(0,-.7,-.76))},
   'taro':{'R':((1,0,0),(0,0,-1)),'L':((0,0,1),(0,-1,0))},
   '80':  {'R':((-1,0,0),(0,0,-1)),'L':((0,0,1),(1,0,0))}
  }
  for side,(direction,normal) in handDirections[ident].items():orientHand(side,direction,normal)
  # Taro's supporting left hand is a fist, not an open vertical beam hand.
  # Ace's guard has relaxed hooked fingers rather than a rigid salute.
  def curl(side,amount):
   hand=bones['bip_hand_'+side]
   d=(bones['bip_middle_0_'+side].head-hand.head).normalized()
   across=(bones['bip_index_0_'+side].head-bones['bip_pinky_0_'+side].head).normalized()
   n=d.cross(across).normalized()*(1 if side=='L' else -1)
   axis=d.cross(n).normalized()
   for finger in ['index','middle','ring','pinky']:
    for j,degrees in enumerate([65,85,55]):
     bone=bones[f'bip_{finger}_{j}_{side}'];head=bone.head.copy()
     rotation=Matrix.Rotation(math.radians(degrees*amount),4,axis)
     bone.matrix=Matrix.Translation(head)@rotation@Matrix.Translation(-head)@bone.matrix;bpy.context.view_layer.update()
  if ident=='taro':curl('L',1)
  if ident=='ace':curl('R',.12);curl('L',.16)
  # A small whole-body turn lets the arm construction read in a frontal cabinet.
  yaw={'jack':-12,'ace':-16,'taro':8,'80':12}[ident]
  for rootBone in [b for b in bones if b.parent is None]:
   rootBone.matrix=Matrix.Rotation(math.radians(yaw),4,'Z')@rootBone.matrix
  bpy.context.view_layer.update()
  feetCenter=sum((arm.matrix_world@bones['bip_foot_'+side].head for side in ['L','R']),Vector())/2
  pivots[ident]={'x':feetCenter.x,'z':-feetCenter.y}
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
 bpy.ops.wm.save_as_mainfile(filepath=str(root/f'artifacts/ultra-pose-v2/{ident}.blend'))
 bpy.ops.export_scene.gltf(filepath=str(out/f'{ident}.glb'),export_format='GLB',export_animations=False,export_apply=True,export_yup=True)
 report.append({'id':ident,'source':str(mdl.relative_to(root)),'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'bytes':(out/f'{ident}.glb').stat().st_size,'pose':{'jack':'Spacium Beam','ace':'Classic fighting guard','taro':'Strium Beam','80':'Sakcium Beam wind-up'}[ident],'poseReference':'https://tamashiiweb.com/item/'+{'jack':'12387','ace':'13206','taro':'10310','80':'10803'}[ident]+'/'})
(root/'artifacts/ultra-pose-v2/model-conversion.json').write_text(json.dumps(report,indent=2))

# Keep the original download provenance alongside the new, reversible pose exports.
import hashlib
sources=json.loads((root/'public/assets/profile/dungeon-v5/models/sources.json').read_text())
refs=json.loads((root/'artifacts/ultra-pose-v2/references/sources.json').read_text())
photoIndex={'jack':6,'ace':0,'taro':3,'80':1}
poseNames={'jack':'Spacium Beam','ace':'Classic fighting guard','taro':'Strium Beam','80':'Sakcium Beam wind-up'}
for source in sources:
 ident=source['id'];source['displayPose']=poseNames[ident]
 source['poseReference']='https://tamashiiweb.com/item/'+{'jack':'12387','ace':'13206','taro':'10310','80':'10803'}[ident]+'/'
 source['poseImage']='https://tamashiiweb.com'+refs[ident][photoIndex[ident]]
 source['changes']='Original SourceIO rig posed per-character against official Bandai references; hand palm planes, finger joints, stance and body yaw authored separately, then baked into original textured meshes.'
 source['runtimeSha256']=hashlib.sha256((out/f'{ident}.glb').read_bytes()).hexdigest()
(out/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n')

(out/'pivots.json').write_text(json.dumps(pivots,indent=2)+'\n')
