from pathlib import Path
import math

import bpy
from mathutils import Vector


HERE = Path(__file__).resolve().parent
SCREENSHOT = HERE.parent / "2026-08-15-video" / "ios26-home.png"
BACKGROUND = HERE / "watchly-cinema-background-clean.png"
OUTPUT = HERE / "watchly-cinema-3d-exact-home.png"
BLEND_FILE = HERE / "watchly-cinema-3d-exact-home.blend"


def set_input(node, name, value):
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def make_principled_material(
    name,
    base_color,
    metallic=0.0,
    roughness=0.4,
    coat_weight=0.0,
    coat_roughness=0.08,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    set_input(principled, "Base Color", base_color)
    set_input(principled, "Metallic", metallic)
    set_input(principled, "Roughness", roughness)
    set_input(principled, "IOR", 1.46)
    set_input(principled, "Coat Weight", coat_weight)
    set_input(principled, "Coat Roughness", coat_roughness)
    return material


def make_image_material(
    name,
    image_path,
    emission_strength=0.0,
    roughness=0.35,
    coat_weight=0.42,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(image_path), check_existing=True)
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    set_input(principled, "Metallic", 0.0)
    set_input(principled, "Roughness", roughness)
    set_input(principled, "IOR", 1.46)
    set_input(principled, "Coat Weight", coat_weight)
    set_input(principled, "Coat Roughness", 0.07)
    if emission_strength > 0:
        emission = principled.inputs.get("Emission Color")
        if emission is not None:
            links.new(texture.outputs["Color"], emission)
        set_input(principled, "Emission Strength", emission_strength)
    return material


def add_beveled_cube(name, dimensions, location, material, bevel_width, segments=8):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new(name="Precision bevel", type="BEVEL")
    bevel.width = bevel_width
    bevel.segments = segments
    bevel.limit_method = "ANGLE"
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def rounded_rectangle_points(width, height, radius, corner_segments=18):
    half_width = width / 2
    half_height = height / 2
    centers = (
        (half_width - radius, half_height - radius, 0, 90),
        (-half_width + radius, half_height - radius, 90, 180),
        (-half_width + radius, -half_height + radius, 180, 270),
        (half_width - radius, -half_height + radius, 270, 360),
    )
    points = []
    for center_x, center_z, start, end in centers:
        for step in range(corner_segments):
            angle = math.radians(start + (end - start) * step / corner_segments)
            points.append(
                (
                    center_x + radius * math.cos(angle),
                    center_z + radius * math.sin(angle),
                )
            )
    return points


def add_extruded_rounded_rectangle(
    name,
    width,
    height,
    depth,
    radius,
    location,
    material,
    edge_bevel=0.0,
):
    boundary = rounded_rectangle_points(width, height, radius, corner_segments=24)
    boundary_count = len(boundary)
    front_y = -depth / 2
    back_y = depth / 2
    vertices = [(x, front_y, z) for x, z in boundary]
    vertices.extend((x, back_y, z) for x, z in boundary)

    faces = [
        tuple(range(boundary_count)),
        tuple(reversed(range(boundary_count, boundary_count * 2))),
    ]
    for index in range(boundary_count):
        following = (index + 1) % boundary_count
        faces.append(
            (
                index,
                following,
                boundary_count + following,
                boundary_count + index,
            )
        )

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(material)
    for polygon in obj.data.polygons[2:]:
        polygon.use_smooth = True

    if edge_bevel > 0:
        bevel = obj.modifiers.new(name="Micro chamfer", type="BEVEL")
        bevel.width = edge_bevel
        bevel.segments = 4
        bevel.limit_method = "ANGLE"
    return obj


def add_rounded_image_plane(name, width, height, radius, y, image_path, material):
    boundary = rounded_rectangle_points(width, height, radius)
    vertices = [(0.0, y, 0.0)] + [(x, y, z) for x, z in boundary]
    faces = []
    boundary_count = len(boundary)
    for index in range(boundary_count):
        current = index + 1
        following = ((index + 1) % boundary_count) + 1
        faces.append((0, current, following))

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)

    uv_layer = mesh.uv_layers.new(name="Screen UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (
                vertex.x / width + 0.5,
                vertex.z / height + 0.5,
            )
    return obj


def add_background_plane(image_path, material):
    width = 17.1
    height = 9.62
    y = 4.5
    vertices = (
        (-width / 2, y, -height / 2),
        (width / 2, y, -height / 2),
        (width / 2, y, height / 2),
        (-width / 2, y, height / 2),
    )
    mesh = bpy.data.meshes.new("CinemaBackgroundMesh")
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new("Cinema background", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="Background UV")
    uv_values = ((0, 0), (1, 0), (1, 1), (0, 1))
    for polygon in mesh.polygons:
        for loop_index, uv in zip(polygon.loop_indices, uv_values):
            uv_layer.data[loop_index].uv = uv
    return obj


def add_area_light(name, location, energy, color, size, target=(1.7, 0.0, 0.0)):
    data = bpy.data.lights.new(name=name, type="AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def build_scene():
    if not SCREENSHOT.exists():
        raise FileNotFoundError(SCREENSHOT)
    if not BACKGROUND.exists():
        raise FileNotFoundError(BACKGROUND)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data_block in bpy.data.materials:
        bpy.data.materials.remove(data_block)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 2048
    scene.render.resolution_y = 1152
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(OUTPUT)
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.world.color = (0.002, 0.002, 0.003)

    scene.view_settings.look = "AgX - Medium High Contrast"

    background_material = make_image_material(
        "Cinema background material",
        BACKGROUND,
        emission_strength=0.38,
        roughness=1.0,
        coat_weight=0.0,
    )
    add_background_plane(BACKGROUND, background_material)

    frame_material = make_principled_material(
        "Black titanium",
        (0.025, 0.028, 0.033, 1.0),
        metallic=0.88,
        roughness=0.24,
        coat_weight=0.22,
        coat_roughness=0.12,
    )
    side_material = make_principled_material(
        "Ceramic Shield edge",
        (0.003, 0.004, 0.006, 1.0),
        metallic=0.05,
        roughness=0.08,
        coat_weight=0.68,
        coat_roughness=0.035,
    )
    screen_material = make_image_material(
        "Exact Watchly Home screen",
        SCREENSHOT,
        emission_strength=0.22,
        roughness=0.16,
    )

    root = bpy.data.objects.new("Watchly phone root", None)
    bpy.context.collection.objects.link(root)
    root.location = (2.15, -0.1, 0.0)
    root.rotation_euler = (
        math.radians(3.5),
        math.radians(-2.0),
        math.radians(-8.5),
    )
    root.scale = (1.1, 1.1, 1.1)

    body = add_extruded_rounded_rectangle(
        "Phone body",
        width=3.209,
        height=6.720,
        depth=0.371,
        radius=0.505,
        location=(0.0, 0.0, 0.0),
        material=frame_material,
        edge_bevel=0.035,
    )
    body.parent = root

    edge = add_extruded_rounded_rectangle(
        "Ceramic Shield front",
        width=3.119,
        height=6.629,
        depth=0.082,
        radius=0.475,
        location=(0.0, -0.190, 0.0),
        material=side_material,
        edge_bevel=0.018,
    )
    edge.parent = root

    screen = add_rounded_image_plane(
        "Watchly Home exact texture",
        width=2.989,
        height=6.503,
        radius=0.425,
        y=-0.238,
        image_path=SCREENSHOT,
        material=screen_material,
    )
    screen.parent = root

    volume_button = add_beveled_cube(
        "Volume up button",
        (0.026, 0.145, 0.46),
        (-1.617, -0.004, 1.28),
        frame_material,
        bevel_width=0.012,
        segments=5,
    )
    volume_button.parent = root
    volume_down_button = add_beveled_cube(
        "Volume down button",
        (0.026, 0.145, 0.46),
        (-1.617, -0.004, 0.68),
        frame_material,
        bevel_width=0.012,
        segments=5,
    )
    volume_down_button.parent = root
    action_button = add_beveled_cube(
        "Action button",
        (0.026, 0.145, 0.31),
        (-1.617, -0.004, 2.05),
        frame_material,
        bevel_width=0.012,
        segments=5,
    )
    action_button.parent = root
    power_button = add_beveled_cube(
        "Power button",
        (0.026, 0.145, 0.63),
        (1.617, -0.004, 1.25),
        frame_material,
        bevel_width=0.012,
        segments=5,
    )
    power_button.parent = root

    add_area_light(
        "Soft burgundy key",
        (-4.0, -5.5, 4.8),
        energy=720,
        color=(1.0, 0.055, 0.085),
        size=5.5,
    )
    add_area_light(
        "Cool glass fill",
        (5.0, -4.0, 3.2),
        energy=460,
        color=(0.55, 0.67, 1.0),
        size=4.0,
    )
    add_area_light(
        "Top edge strip",
        (0.5, -2.4, 6.4),
        energy=510,
        color=(1.0, 0.44, 0.34),
        size=3.0,
    )

    camera_data = bpy.data.cameras.new("Presentation camera")
    camera = bpy.data.objects.new("Presentation camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, -15.0, 0.1)
    target = Vector((0.0, 0.0, 0.0))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 17.1
    camera_data.lens = 58
    scene.camera = camera

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_FILE))
    bpy.ops.render.render(write_still=True)
    print(OUTPUT)


build_scene()
