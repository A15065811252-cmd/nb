import * as THREE from "three";
import {buildDistrict} from "./map.js";
import {createDoor} from "./door.js";
import {createCharacterPhysics, initializePhysics} from "./physics.js";

const palettes = {
  london: { wall: 0x514e4a, trim: 0x382f29, floor: 0x534437, sky: 0x899fa9, lamp: 0xffc48c, haze: 0x292725 },
  parlor: { wall: 0x655a48, trim: 0x3e2d24, floor: 0x5c493a, sky: 0xabb7ba, lamp: 0xffca89, haze: 0x2d2824 },
  rectory: { wall: 0x555b4b, trim: 0x382c24, floor: 0x675142, sky: 0x929c81, lamp: 0xffbd76, haze: 0x282923 },
  church: { wall: 0x68665a, trim: 0x44362b, floor: 0x686457, sky: 0x9baab3, lamp: 0xecc38e, haze: 0x292b29 },
  school: { wall: 0x535b53, trim: 0x342f29, floor: 0x574c40, sky: 0x96abb4, lamp: 0xf6c88f, haze: 0x232924 },
  study: { wall: 0x605a4c, trim: 0x392d25, floor: 0x5a4a37, sky: 0x98a4a1, lamp: 0xffc383, haze: 0x2a2721 }
};

const look = new THREE.Vector3();
const projected = new THREE.Vector3();
const eye = 1.58;
const interior = {minX: -5.06, maxX: 5.06, minZ: -5.35, maxZ: 5.20};
const doorwayDepth = .78;
const wood = 0x49372a;
const darkWood = 0x30241e;
const paper = 0xddc9a5;
const brass = 0xb88c4a;
const linen = 0xd1c3a9;
const green = 0x53604c;
const red = 0x793f35;

function box(parent, color, width, height, depth, x, y, z, rotation = 0) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: .89 })
  );
  object.position.set(x, y, z);
  object.rotation.y = rotation;
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function shape(parent, geometry, color, x, y, z) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .8 }));
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function group(parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Group();
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function cylinder(parent, color, top, bottom, height, x, y, z, sides = 12) {
  return shape(parent, new THREE.CylinderGeometry(top, bottom, height, sides), color, x, y, z);
}

function table(parent, width, depth, height) {
  box(parent, darkWood, width, .12, depth, 0, height, 0);
  box(parent, wood, width - .08, .16, depth - .09, 0, height - .09, 0);
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) box(parent, wood, .085, height, .085, x * (width / 2 - .12), height / 2, z * (depth / 2 - .13));
  }
}

function chair(parent, width = .58) {
  box(parent, wood, width, .10, .54, 0, .52, 0);
  box(parent, green, width - .07, .05, .46, 0, .59, .03);
  for (const x of [-1, 1]) {
    box(parent, darkWood, .07, 1.08, .07, x * (width / 2 - .05), .54, -.22);
    box(parent, wood, .07, .52, .07, x * (width / 2 - .05), .26, .22);
  }
  box(parent, wood, width, .15, .08, 0, 1.02, -.22);
  box(parent, wood, width - .1, .20, .06, 0, .85, -.22);
}

function book(parent, color = green, x = 0, y = 0, z = 0, angle = 0) {
  const volume = group(parent, x, y, z);
  volume.rotation.y = angle;
  box(volume, color, .56, .034, .384, 0, .018, 0);
  box(volume, paper, .53, .062, .355, .012, .065, 0);
  box(volume, color, .56, .029, .384, 0, .107, 0);
  box(volume, color, .047, .103, .38, -.262, .056, 0);
  box(volume, brass, .19, .004, .018, .04, .123, -.055);
  box(volume, brass, .15, .004, .012, .04, .123, -.015);
}

function openBook(parent, x, y, z) {
  const open = group(parent, x, y, z);
  box(open, darkWood, .80, .037, .49, 0, .02, 0);
  for (const side of [-1, 1]) {
    const page = group(open, side * .18, .055, 0);
    page.rotation.z = side * .07;
    box(page, paper, .33, .045, .465, 0, 0, 0);
    for (let row = 0; row < 7; row++) box(page, 0x8e7960, .24 - (row % 3) * .023, .002, .005, 0, .024, -.16 + row * .038);
  }
}

function lamp(parent, x, y, z) {
  const base = group(parent, x, y, z);
  cylinder(base, brass, .13, .19, .07, 0, .04, 0);
  cylinder(base, brass, .035, .07, .26, 0, .18, 0);
  const globe = shape(base, new THREE.SphereGeometry(.12, 16, 12), 0xe8b97a, 0, .38, 0);
  globe.scale.y = 1.32;
  globe.material.emissive.setHex(0xc36f32);
  globe.material.emissiveIntensity = 1.2;
  cylinder(base, 0xb89468, .09, .23, .19, 0, .51, 0);
  const warm = new THREE.PointLight(0xffb47a, 15, 6, 2);
  warm.position.set(0, .49, .14);
  base.add(warm);
}

function bed(parent, cover = red, mother = false) {
  const height = .64;
  box(parent, darkWood, 1.31, .15, 2.45, 0, .38, 0);
  for (const x of [-.61, .61]) for (const z of [-1.14, 1.14]) box(parent, wood, .11, .55, .11, x, .29, z);
  box(parent, wood, 1.33, 1.06, .14, 0, .64, -1.16);
  box(parent, darkWood, 1.42, .10, .19, 0, 1.19, -1.16);
  box(parent, linen, 1.21, .28, 2.28, 0, .53, 0);
  const pillow = shape(parent, new THREE.SphereGeometry(1, 18, 8), 0xe6dcca, 0, height + .10, -.73);
  pillow.scale.set(.48, .12, .26);
  box(parent, cover, 1.27, .09, 1.7, 0, height + .03, .27);
  box(parent, cover, .04, .23, 1.69, .63, .58, .27);
  box(parent, cover, .04, .23, 1.69, -.63, .58, .27);
  box(parent, 0xb19670, 1.28, .078, .13, 0, height + .082, -.55);
  for (const z of [.52, .63, .74, .85]) box(parent, 0xa68061, 1.26, .009, .014, 0, height + .078, z);
  if (mother) {
    const person = shape(parent, new THREE.SphereGeometry(1, 18, 9), cover, 0, height + .1, -.12);
    person.scale.set(.38, .23, .65);
    const head = shape(parent, new THREE.SphereGeometry(.16, 16, 12), 0xd7aa89, 0, .82, -.76);
    head.scale.z = 1.23;
    const cap = shape(parent, new THREE.SphereGeometry(.163, 16, 12), 0xe2d5ba, 0, .865, -.82);
    cap.scale.set(1.02, .73, .92);
  }
}

function carpet(parent, width, length, color, x, z) {
  box(parent, color, width, .015, length, x, .025, z);
  for (const edge of [-1, 1]) {
    box(parent, 0xb89764, width - .13, .010, .043, x, .037, z + edge * (length / 2 - .13));
    box(parent, 0xb89764, .043, .010, length - .23, x + edge * (width / 2 - .13), .037, z);
  }
  for (let i = -2; i <= 2; i++) {
    const diamond = box(parent, 0x9d7756, .31, .008, .31, x, .04, z + i * length / 7);
    diamond.rotation.y = Math.PI / 4;
  }
}

function windowTexture(color, city, stained) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  const sky = new THREE.Color(color);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, sky.clone().multiplyScalar(.75).getStyle());
  gradient.addColorStop(.56, sky.clone().multiplyScalar(1.25).getStyle());
  gradient.addColorStop(1, "#c5c0a1");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (city) {
    ctx.fillStyle = "#9ba9ae";
    ctx.fillRect(0, 146, 192, 80);
    for (let i = 0; i < 10; i++) {
      const x = i * 22 - 6;
      const h = 26 + (i * 13) % 38;
      ctx.fillStyle = i % 2 ? "#8a9b9e" : "#92a2a5";
      ctx.fillRect(x, 199 - h, 21, 38 + h);
      ctx.fillRect(x + 8, 188 - h, 5, 13);
    }
    for (let i = 0; i < 7; i++) {
      const x = i * 31 - 13;
      const h = 40 + (i * 31) % 53;
      ctx.fillStyle = i % 2 ? "#777b79" : "#697372";
      ctx.fillRect(x, 224 - h, 33, h);
      ctx.beginPath();
      ctx.moveTo(x - 2, 224 - h);
      ctx.lineTo(x + 15, 201 - h);
      ctx.lineTo(x + 36, 224 - h);
      ctx.fill();
      ctx.fillStyle = "#a8a49a";
      ctx.fillRect(x + 11, 239 - h, 6, 10);
      ctx.fillRect(x + 21, 246 - h, 5, 9);
    }
    const fog = ctx.createLinearGradient(0, 137, 0, 222);
    fog.addColorStop(0, "#a2b1b595");
    fog.addColorStop(1, "#b6c2bd28");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 137, 192, 86);
    for (let i = 0; i < 32; i++) {
      const x = (i * 73 + 19) % 190;
      const y = (i * 41 + 33) % 213;
      ctx.fillStyle = i % 4 ? "#dce2dc46" : "#e4ede997";
      ctx.fillRect(x, y, 1, 2 + i % 4);
    }
  }
  if (stained) {
    for (let i = -2; i <= 12; i++) {
      for (let j = -1; j <= 10; j++) {
        const x = i * 21;
        const y = j * 26 + (i % 2) * 13;
        ctx.beginPath();
        ctx.moveTo(x, y - 13);
        ctx.lineTo(x + 21, y);
        ctx.lineTo(x, y + 13);
        ctx.lineTo(x - 21, y);
        ctx.closePath();
        ctx.fillStyle = ["#bd9060", "#607e81", "#ad755a", "#b8a882", "#7b8c97"][Math.abs(i * 3 + j) % 5];
        ctx.fill();
        ctx.strokeStyle = "#343936";
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function windowFrame(parent, x, y, z, width, height, palette, options = {}) {
  const frame = group(parent, x, y, z);
  box(frame, darkWood, width + .22, height + .23, .17, 0, 0, -.03);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
    map: windowTexture(palette.sky, options.city, options.stained),
    color: 0xdbdbcf
  }));
  pane.position.z = .076;
  frame.add(pane);
  for (const bar of [-.5, 0, .5]) {
    box(frame, wood, .058, height + .06, .07, width * bar, 0, .09);
    box(frame, wood, width + .05, .058, .07, 0, height * bar, .09);
  }
  box(frame, wood, width + .34, .105, .36, 0, -height / 2 - .065, .07);
  const curtains = [];
  if (options.curtains) {
    const fabric = options.curtains;
    box(frame, brass, width + .80, .06, .08, 0, height / 2 + .25, .26);
    for (const side of [-1, 1]) {
      const folds = options.opens ? 10 : 6;
      for (let fold = 0; fold < folds; fold++) {
        const far = width / 2 + .015 + fold * (options.opens ? .039 : .066);
        const near = .28 + fold * (width / 2 + .13 - .28) / (folds - 1);
        const px = far * side;
        const linenFold = cylinder(frame, new THREE.Color(fabric).multiplyScalar(.74 + fold % 3 * .15),
          options.opens ? .093 : .062, .095, height + .52, px, -.05, .28 + Math.sin(fold * 1.6) * .062);
        curtains.push({linenFold, side, near, far});
      }
    }
  }
  return {
    x, z: z + .20, marker: y - .31, obstacle: 0,
    setOpen(value) {
      for (const {linenFold, side, near, far} of curtains) {
        linenFold.position.x = side * THREE.MathUtils.lerp(near, far, value);
      }
    }
  };
}

function makeDoor(parent, options) {
  return createDoor(parent, {box, group, cylinder, shape}, options);
}

function addLanding(parent, palette, x, obstacles, worldX = x) {
  const corridor = group(parent, x, 0, -7.59);
  box(corridor, palette.floor, 2.04, .15, 3.12, 0, -.075, 0);
  box(corridor, palette.wall, 2.06, 3.10, .16, 0, 1.55, -1.55);
  box(corridor, palette.wall, 2.06, .15, 3.18, 0, 3.02, 0);
  for (const side of [-1, 1]) {
    box(corridor, palette.wall, .17, 3.10, 3.12, side * 1.02, 1.55, 0);
    box(corridor, palette.trim, .20, .17, 3.06, side * .99, .11, 0);
  }
  framed(corridor, 0, 1.67, -1.42, 0x645c4e);
  const light = new THREE.PointLight(0xffc38d, 9, 4, 2);
  light.position.set(0, 2.30, -.77);
  corridor.add(light);
  for (const [left, right] of [[worldX - x - 5.65, worldX - .76], [worldX + .76, worldX - x + 5.65]]) {
    obstacles.push({x: (left + right) / 2, z: -7.63, w: right - left, d: 3.18});
  }
}

function fireplace(parent, x, z) {
  const hearth = group(parent, x, 0, z);
  box(hearth, 0x7e725b, 2.24, 1.55, .19, 0, .82, 0);
  box(hearth, 0x292423, 1.28, 1.05, .24, 0, .58, .07);
  box(hearth, 0x95866c, 2.45, .14, .45, 0, 1.62, .11);
  box(hearth, 0x655c4e, 2.27, .08, .63, 0, .04, .27);
  for (let i = 0; i < 6; i++) {
    const ember = shape(hearth, new THREE.IcosahedronGeometry(.12, 0), 0xb75a35, (i - 2.5) * .14, .19 + i % 2 * .072, .31);
    ember.material.emissive.setHex(0xba4b23);
    ember.material.emissiveIntensity = 1.45;
  }
  const firelight = new THREE.PointLight(0xfd9860, 11, 4, 2);
  firelight.position.set(0, .4, .72);
  hearth.add(firelight);
  return firelight;
}

function shelf(parent, x, z) {
  const shelf = group(parent, x, 0, z);
  box(shelf, darkWood, 2.1, 2.8, .22, 0, 1.43, -.16);
  for (const side of [-1, 1]) box(shelf, wood, .09, 2.83, .43, side * 1.02, 1.42, 0);
  for (let row = 0; row < 4; row++) {
    const y = .47 + row * .59;
    box(shelf, wood, 2.13, .08, .47, 0, y, .03);
    for (let i = 0; i < 12; i++) {
      const height = .26 + (i * 13 + row * 7) % 16 / 100;
      const color = [red, 0x7d6645, green, 0x5b6a70, darkWood][(i * 2 + row) % 5];
      box(shelf, color, .107, height, .25, -.87 + i * .139, y + height / 2 + .04, .01);
    }
  }
}

function framed(parent, x, y, z, color = 0x627166) {
  const frame = group(parent, x, y, z);
  box(frame, wood, .70, .84, .08, 0, 0, 0);
  box(frame, brass, .59, .73, .084, 0, 0, .009);
  box(frame, 0xcebea0, .55, .69, .09, 0, 0, .021);
  box(frame, color, .45, .57, .095, 0, 0, .029);
  const image = shape(frame, new THREE.SphereGeometry(.152, 10, 8), 0xbba990, 0, .10, .087);
  image.scale.set(.61, .90, .063);
  const coat = shape(frame, new THREE.SphereGeometry(.18, 10, 8), 0x46433b, 0, -.10, .084);
  coat.scale.set(.96, .70, .045);
}

function room(parent, palette, sceneName, openWall, rearDoorX) {
  const stone = sceneName === "church";
  box(parent, palette.floor, 11.1, .27, 12.3, 0, -.15, 0);
  function rearPieces(callback) {
    if (rearDoorX === undefined) {
      callback(11.2, 0);
      return;
    }
    for (const [left, right] of [[-5.6, rearDoorX - .75], [rearDoorX + .75, 5.6]]) {
      callback(right - left, (left + right) / 2);
    }
  }
  rearPieces((width, x) => box(parent, palette.wall, width, 5.5, .3, x, 2.72, -6.13));
  if (rearDoorX !== undefined) box(parent, palette.wall, 1.50, 2.57, .3, rearDoorX, 4.18, -6.13);
  function sidePieces(callback, side) {
    if (side === openWall) {
      callback(4.34, -4.01);
      callback(6.17, 3.11);
    } else callback(12.4, 0);
  }
  for (const side of [-1, 1]) {
    sidePieces((depth, z) => box(parent, palette.wall, .28, 5.5, depth, side * 5.55, 2.72, z), side);
    if (side === openWall) box(parent, palette.wall, .28, 2.71, 1.91, side * 5.55, 4.1, -.903);
  }
  box(parent, palette.wall, 11.2, 5.5, .3, 0, 2.72, 6.13);
  box(parent, palette.wall, 11.2, .18, 12.3, 0, 5.44, 0);
  const seam = stone ? 1.1 : .39;
  for (let x = -5.25; x < 5.4; x += seam) {
    const plank = Math.round((x + 5.25) / seam);
    box(parent, new THREE.Color(palette.floor).multiplyScalar(.93 + (plank * 17 % 11) / 90), seam - .026, .017, 11.96, x, .004, 0);
    for (let i = 0; i < 3; i++) box(parent, 0x392e26, seam - .028, .003, .015, x, .014, -4.55 + i * 3.14 + ((plank * 13) % 9) / 4);
  }
  for (const y of [.12, .99, 1.09, 4.64, 5.19]) {
    if (y < 2.8) rearPieces((width, x) => box(parent, palette.trim, width, .083, .155, x, y, -5.93));
    else box(parent, palette.trim, 10.95, .083, .155, 0, y, -5.93);
    for (const side of [-1, 1]) {
      sidePieces((depth, z) => box(parent, palette.trim, .12, .083, depth, side * 5.39, y, z), side);
    }
  }
  for (let i = -5; i <= 5; i += 1.1) {
    if (rearDoorX === undefined || Math.abs(i - rearDoorX) > .77) {
      box(parent, palette.trim, .065, .81, .11, i, .56, -5.88);
    }
    if (!stone) for (const side of [-1, 1]) {
      if (side !== openWall || i < -1.89 || i > .025) box(parent, palette.trim, .105, .81, .065, side * 5.36, .56, i);
    }
  }
  if (!stone) {
    for (let i = -5.25; i <= 5.4; i += .24) {
      if (rearDoorX !== undefined && Math.abs(i - rearDoorX) < .76) continue;
      const tint = new THREE.Color(palette.wall).multiplyScalar(i % .51 > .15 ? 1.06 : .94);
      box(parent, tint, .025, 3.6, .019, i, 2.89, -5.971);
    }
  }
}

function attendant(parent, x, z) {
  const maid = group(parent, x, 0, z);
  maid.rotation.y = -.51;
  const skirt = cylinder(maid, 0x42483f, .18, .39, .97, 0, .53, 0);
  skirt.scale.z = .78;
  const apron = shape(maid, new THREE.SphereGeometry(1, 11, 8), 0xc6b9a0, 0, .57, .246);
  apron.scale.set(.239, .39, .067);
  const body = shape(maid, new THREE.SphereGeometry(1, 12, 8), 0x445043, 0, 1.14, 0);
  body.scale.set(.26, .32, .205);
  box(maid, 0xc7bba6, .265, .29, .055, 0, 1.13, .197);
  for (const side of [-1, 1]) {
    const arm = cylinder(maid, green, .075, .062, .48, .265 * side, 1.05, .032);
    arm.rotation.z = side * .19;
    shape(maid, new THREE.SphereGeometry(.069, 11, 8), 0xc39c7f, side * .299, .81, .05);
  }
  const hair = shape(maid, new THREE.SphereGeometry(.153, 15, 10), 0x4e372a, 0, 1.56, -.039);
  hair.scale.y = 1.15;
  const face = shape(maid, new THREE.SphereGeometry(.135, 15, 10), 0xc39c7f, 0, 1.54, .031);
  face.scale.y = 1.19;
  const bonnet = shape(maid, new THREE.SphereGeometry(.167, 15, 11), 0xe4d7b7, 0, 1.663, -.024);
  bonnet.scale.set(1.04, .46, .92);
}

function dawnChamber(scene, palette, found) {
  const child = group(scene);
  const mother = group(scene, 11.10, -.68, 0);
  const entryX = 3.52;
  const obstacles = [];
  room(child, palette, "london", 1, entryX);
  addLanding(child, palette, entryX, obstacles);
  const entryDoor = makeDoor(child, {x: entryX, z: -5.99, color: 0x69513c});
  const lowerPalette = {...palette, wall: 0x5b5148, floor: 0x593f32};
  const hallX = 3.52;
  room(mother, lowerPalette, "london", -1, hallX);
  addLanding(mother, lowerPalette, hallX, obstacles, hallX + 11.10);
  const window = windowFrame(child, -.46, 2.96, -5.80, 2.27, 2.38, palette, {
    city: true, curtains: 0x6b4744, opens: true
  });
  const childBed = group(child, -2.95, 0, -2.94);
  bed(childBed, green);
  carpet(child, 5.30, 4.55, 0x604437, .25, .83);
  const washstand = group(child, -3.97, 0, -4.49);
  table(washstand, .75, .66, .81);
  cylinder(washstand, 0xd4c4a2, .26, .17, .115, 0, .945, .0, 16);
  cylinder(washstand, 0xaeb1a1, .214, .214, .009, 0, 1.007, .0, 16);
  lamp(washstand, -.09, .903, -.23);
  const chest = group(child, 3.28, 0, 2.28);
  box(chest, wood, 1.81, .79, .72, 0, .43, 0);
  box(chest, darkWood, 1.9, .10, .80, 0, .86, 0);
  for (const y of [.26, .50, .72]) {
    box(chest, 0x654c39, 1.66, .16, .05, 0, y, .37);
    box(chest, brass, .12, .045, .083, .0, y, .42);
  }
  framed(child, 1.50, 2.43, -5.76, 0x686957);
  const floors = [
    {x: 0, z: 0, w: 11.10, d: 12.3, top: 0},
    {x: 11.10, z: 0, w: 11.10, d: 12.3, top: -.68},
    {x: entryX, z: -7.59, w: 2.04, d: 3.12, top: 0},
    {x: hallX + 11.10, z: -7.59, w: 2.04, d: 3.12, top: -.68}
  ];
  for (let i = 0; i < 4; i++) {
    const level = -.17 * (i + 1);
    box(scene, darkWood, .337, .68 + level, 1.93, 5.55 + i * .32 + .16, (level - .68) / 2, -.92);
    box(scene, wood, .35, .035, 1.94, 5.55 + i * .32 + .16, level, -.92);
    floors.push({x: 5.55 + i * .32 + .16, z: -.92, w: .35, d: 1.94, top: level + .0175});
  }
  const stairDoor = makeDoor(scene, {
    x: 5.53, z: -.92, width: 1.70, height: 2.67, rotation: Math.PI / 2,
    swing: -1, color: 0x604938, initialOpen: found > 1
  });
  const lowerWindow = windowFrame(mother, .30, 2.93, -5.80, 2.37, 2.59, palette,
    {city: true, curtains: 0x554744});
  lowerWindow.setOpen(.72);
  const maternalBedX = -1.94;
  const maternalBedZ = -3.02;
  bed(group(mother, maternalBedX, 0, maternalBedZ), red, true);
  const bedside = group(mother, -3.14, 0, -3.89);
  table(bedside, .69, .64, .81);
  lamp(bedside, .05, .89, -.052);
  const seat = group(mother, .30, 0, -2.92);
  seat.rotation.y = -.44;
  chair(seat, .69);
  carpet(mother, 4.90, 2.90, 0x68453c, .13, -.48);
  attendant(mother, -3.85, -2.31);
  const door = makeDoor(mother, {x: hallX, z: -5.99, color: 0x72543e});

  const daylight = new THREE.SpotLight(0xb9d4e3, 22, 19, .66, .67, 2);
  daylight.position.set(-.44, 3.82, -5.14);
  daylight.target.position.set(1.04, .16, 1.60);
  const interiorLight = new THREE.HemisphereLight(0xe3e5dc, 0x2c231c, 1.15);
  const lampFill = new THREE.PointLight(0xffc58a, 34, 15, 2);
  lampFill.position.set(8.05, 2.28, -4.27);
  const glassFill = new THREE.PointLight(0xa2bed0, 27, 14, 2);
  glassFill.position.set(11.39, 2.62, -5.15);
  scene.add(daylight, daylight.target, interiorLight, lampFill, glassFill);

  let opening = found ? 1 : 0;
  let goal = opening;
  const showWindow = () => {
    window.setOpen(opening);
    daylight.intensity = 20 + opening * 252;
    interiorLight.intensity = 1.18 + opening * .65;
  };
  showWindow();
  const passage = (from, to) => {
    if ((from.x < 5.55) === (to.x < 5.55)) return [];
    const west = {x: 4.60, z: -.915};
    const east = {x: 7.02, z: -.915};
    return from.x < 5.55 ? [west, east] : [east, west];
  };
  const entrance = {x: 5.55, z: -.915, marker: 1.37, obstacle: 0};
  const marks = [
    window,
    {x: maternalBedX + 11.10, z: maternalBedZ + .52, marker: .77, obstacle: .25,
      approach: {x: 10.82, z: -1.74}},
    door
  ];
  return {
    marks,
    bounds: {...interior, maxX: 16.18, minZ: -8.76},
    eyeHeight: 1.30,
    floors,
    doors: [stairDoor, door, entryDoor],
    exitDoor: entryDoor,
    passageDoor: stairDoor,
    obstacles: [...obstacles,
      {x: 5.55, z: -4.04, w: .30, d: 4.32},
      {x: 5.55, z: 3.11, w: .30, d: 6.16},
      {x: -2.95, z: -2.94, w: 1.35, d: 2.52},
      {x: maternalBedX + 11.10, z: maternalBedZ, w: 1.38, d: 2.52},
      {x: 3.28, z: 2.28, w: 1.83, d: .72},
      {x: 11.40, z: -2.92, w: .66, d: .57}
    ],
    passage,
    elevation: (x) => -.68 * THREE.MathUtils.clamp((x - 5.52) / 1.31, 0, 1),
    reveal(index) { if (index === 0) goal = 1; },
    tick(delta) {
      if (opening === goal) return false;
      opening = Math.min(goal, opening + delta * 1.55);
      showWindow();
      return true;
    },
    start: found ? (found > 1 ? {x: 9.15, z: -.50} : {x: 0, z: -2.20}) : {x: -.23, z: 3.80},
    entrance
  };
}

function bench(parent, width = 1.85) {
  box(parent, wood, width, .10, .43, 0, .51, 0);
  box(parent, darkWood, width, .33, .075, 0, .81, -.16);
  box(parent, wood, width + .07, .075, .12, 0, 1.02, -.17);
  for (const x of [-width / 2 + .11, width / 2 - .11]) box(parent, wood, .10, .55, .38, x, .275, 0);
}

function chamber(scene, sceneName, number, palette) {
  const root = group(scene);
  const doorX = 3.85;
  room(root, palette, sceneName, undefined, doorX);
  const marks = {};
  const obstacles = [];
  addLanding(root, palette, doorX, obstacles);
  const block = (x, z, w, d) => obstacles.push({x, z, w, d});
  const city = sceneName === "london" || sceneName === "parlor";
  const school = sceneName === "school" || sceneName === "study";
  const cathedral = sceneName === "church";
  marks.door = makeDoor(root, {x: doorX, z: -5.99, color: city ? 0x684b37 : 0x635043});
  marks.window = windowFrame(root, cathedral ? 0 : -.21, cathedral ? 3.28 : 2.91, -5.81, cathedral ? 1.30 : 2.20, cathedral ? 3.45 : 2.48, palette, {
    city, stained: cathedral, curtains: cathedral ? false : school ? 0x4d5d50 : 0x603e39
  });
  if (city) {
    const roomBed = group(root, -2.41, 0, -3.63);
    bed(roomBed, sceneName === "parlor" ? green : red, number === 1);
    marks.bed = { x: -2.41, z: -2.87, marker: 1.19, obstacle: 0 };
    if (sceneName === "parlor") {
      roomBed.visible = false;
      const armchair = group(root, -2.68, 0, -3.45);
      chair(armchair, .84);
      armchair.rotation.y = .22;
      carpet(root, 4.05, 3.9, red, -.45, -.47);
    } else block(-2.41, -3.63, 1.45, 2.58);
    const side = group(root, -3.54, 0, -4.37);
    table(side, .82, .67, .85);
    lamp(side, .04, .95, -.04);
    const wardrobe = group(root, 4.69, 0, -2.85);
    wardrobe.rotation.y = -Math.PI / 2;
    box(wardrobe, darkWood, 1.65, 2.78, .66, 0, 1.4, 0);
    for (const x of [-.36, .36]) {
      box(wardrobe, wood, .67, 2.47, .10, x, 1.4, .37);
      box(wardrobe, 0x624a37, .49, 2.17, .035, x, 1.4, .43);
      shape(wardrobe, new THREE.SphereGeometry(.039, 8, 6), brass, x / 4, 1.22, .49);
    }
    marks.wardrobe = { x: 4.13, z: -2.84, marker: 1.52, obstacle: 0 };
    block(4.69, -2.85, .70, 1.65);
  } else if (cathedral) {
    for (const side of [-1, 1]) {
      windowFrame(root, side * 2.17, 3.25, -5.81, .96, 2.84, palette, { stained: true });
      for (let i = 0; i < 3; i++) {
        const z = -3.80 + i * 2.34;
        bench(group(root, side * 2.77, 0, z), 2.8);
        block(side * 2.77, z, 2.87, .52);
      }
      for (const z of [-5.38, -1.18, 3.13]) {
        cylinder(root, 0x888276, .29, .34, 4.8, side * 4.85, 2.42, z, 8);
        cylinder(root, 0xa19582, .42, .42, .15, side * 4.85, .08, z, 8);
      }
    }
    marks.pew = {x: 1.8, z: -1.41, marker: 1.08, obstacle: 0};
    carpet(root, 1.74, 7.2, 0x653d36, 0, -.9);
    const altar = group(root, 0, .15, -4.82);
    table(altar, 1.69, .69, .95);
    box(altar, 0xc7bda5, 1.77, .055, .77, 0, 1.038, 0);
    box(altar, brass, .078, .70, .081, 0, 1.47, -.13);
    box(altar, brass, .43, .077, .081, 0, 1.57, -.13);
    lamp(altar, -.60, 1.07, -.10);
    lamp(altar, .60, 1.07, -.10);
  } else if (sceneName === "school") {
    for (const x of [-3.99, -2.17, 1.90]) {
      bed(group(root, x, 0, -4.12), green);
      block(x, -4.12, 1.44, 2.52);
    }
    const curtain = group(root, -4.26, 0, -.96);
    curtain.rotation.y = Math.PI / 2;
    for (const x of [-1, 1]) cylinder(curtain, darkWood, .055, .07, 2.68, x, 1.34, 0);
    box(curtain, darkWood, 2.10, .075, .08, 0, 2.64, 0);
    for (let i = 0; i < 18; i++) cylinder(curtain, new THREE.Color(green).multiplyScalar(.7 + i % 3 * .15), .06, .075, 2.33, -.94 + i * .11, 1.38, i % 2 * .035);
    marks.curtain = { x: -4.03, z: -.94, marker: 1.64, obstacle: 0 };
    bench(group(root, 2.66, 0, -2.15));
    lamp(group(root, 3.98, 0, -3.82), 0, .97, 0);
  } else {
    carpet(root, 4.7, 4.3, sceneName === "study" ? 0x635a3f : 0x70463b, .2, -1.43);
    if (sceneName === "study") {
      shelf(root, -3.88, -5.61);
      const lectern = group(root, 2.35, 0, -3.82);
      table(lectern, 1.53, .78, .85);
      lamp(lectern, .49, .95, -.12);
      openBook(lectern, -.20, .94, .02);
      block(2.35, -3.82, 1.53, .82);
      framed(root, 4.70, 2.15, -5.78, 0x777f6c);
    } else {
      fireplace(root, -3.31, -5.64);
      framed(root, -3.31, 2.32, -5.72, 0x717760);
      const side = group(root, 2.41, 0, -4.27);
      table(side, 1.72, .86, .86);
      lamp(side, .45, .95, -.13);
      chair(group(root, 2.26, 0, -3.64));
      block(2.41, -4.27, 1.72, .89);
    }
  }
  return {root, marks, obstacles, doors: [marks.door], exitDoor: marks.door, bounds: {...interior, minZ: -8.76}};
}

function displayProp(room, kind, index, name) {
  if (room.marks[kind]) return room.marks[kind];
  const positions = [[-1.98, -.75], [.10, -2.56], [2.27, -.77]];
  const [x, z] = positions[index];
  const base = group(room.root, x, 0, z);
  base.rotation.y = index === 0 ? .12 : -.10;
  let height = .88;
  let width = 1.10;
  let depth = .63;

  switch (kind) {
    case "bed": bed(base, green); width = 1.45; depth = 2.60; height = .97; break;
    case "rug": carpet(base, 1.6, 1.6, red, 0, 0); width = 0; depth = 0; height = .35; break;
    case "chair": chair(base); width = .62; depth = .55; height = 1.02; break;
    case "pew":
    case "bench": bench(base, 1.38); width = 1.4; depth = .50; height = 1.02; break;
    case "desk":
      table(base, 1.43, .71, .81);
      openBook(base, -.19, .89, .02);
      box(base, paper, .34, .012, .23, .37, .885, -.06, -.11);
      width = 1.44;
      height = .99;
      break;
    case "blocks":
      for (let i = 0; i < 8; i++) box(base, [red, green, brass][i % 3], .16, .16, .16, (i % 4) * .18 - .27, .085 + Math.floor(i / 4) * .17, -.08, i * .18);
      width = 0;
      depth = 0;
      height = .46;
      break;
    case "ball":
      shape(base, new THREE.SphereGeometry(.23, 18, 14), 0x866248, 0, .23, 0);
      width = 0;
      depth = 0;
      height = .58;
      break;
    default: {
      table(base, width, depth, .80);
      const top = group(base, 0, height, 0);
      switch (kind) {
        case "book": openBook(top, 0, 0, 0); break;
        case "bible": book(top, 0x614432); break;
        case "letter":
        case "paper":
          box(top, paper, .63, .018, .40, 0, 0, 0, -.14);
          for (let i = 0; i < 5; i++) box(top, 0x9c886b, .46 - i % 2 * .09, .003, .011, -.04, .011, -.13 + i * .052, -.14);
          if (kind === "letter") cylinder(top, red, .05, .05, .021, .18, .022, .07);
          break;
        case "portrait": framed(top, 0, .43, -.10); height += .42; break;
        case "clock":
          box(top, wood, .35, .48, .15, 0, .24, 0);
          shape(top, new THREE.SphereGeometry(.135, 16, 10), paper, 0, .29, .08).scale.z = .10;
          box(top, darkWood, .012, .09, .013, 0, .33, .10).rotation.z = -.37;
          box(top, darkWood, .066, .012, .013, -.028, .27, .10);
          height += .32;
          break;
        case "tea":
        case "plate":
          cylinder(top, kind === "tea" ? linen : brass, .29, .25, .025, 0, .018, 0);
          cylinder(top, kind === "tea" ? linen : brass, .10, .074, .16, -.08, .104, -.01);
          cylinder(top, kind === "tea" ? 0x74512c : 0xcab57b, .083, .08, .009, -.08, .186, -.01);
          if (kind === "tea") shape(top, new THREE.SphereGeometry(.088, 10, 8), 0xdcccab, .12, .08, .056).scale.y = 1.32;
          height += .15;
          break;
        case "shoe":
          for (const side of [-1, 1]) {
            const item = shape(top, new THREE.SphereGeometry(1, 12, 8), darkWood, side * .15, .095, 0);
            item.scale.set(side === -1 ? .13 : .093, .095, side === -1 ? .24 : .20);
            box(top, wood, .12, .026, .30, side * .15, .036, .048);
          }
          height += .12;
          break;
        case "bell":
          cylinder(top, brass, .076, .19, .19, 0, .11, 0);
          cylinder(top, darkWood, .041, .049, .13, 0, .264, 0);
          height += .30;
          break;
        case "cane":
          cylinder(top, 0x9a7349, .023, .023, .85, 0, .038, 0).rotation.z = 1.579;
          break;
        case "pen":
          for (const side of [-1, 1]) {
            const half = cylinder(top, darkWood, .023, .023, .253, side * .16, .036, side * .058);
            half.rotation.z = Math.PI / 2;
            half.rotation.y = side * .23;
          }
          break;
        case "nibs":
          for (const side of [-1, 1]) {
            const nib = group(top, side * .083, .015 - side * .006, 0);
            nib.rotation.y = side * .70;
            box(nib, 0x8c928e, .087, .021, .19, 0, 0, -.02);
            const point = cylinder(nib, 0xaab0ab, 0, .057, .13, 0, 0, .135, 4);
            point.rotation.x = Math.PI / 2;
          }
          break;
        default: throw new Error("Unknown scene prop: " + name);
      }
      break;
    }
  }
  if (width) room.obstacles.push({x, z, w: width, d: depth});
  return {x, z, marker: height + .12, obstacle: depth / 2};
}

function lighting(scene, palette, isChurch) {
  scene.add(new THREE.HemisphereLight(0xf2eee3, palette.haze, isChurch ? 2.30 : 2.48));
  const sun = new THREE.SpotLight(palette.sky, isChurch ? 210 : 145, 30, .72, .6, 2);
  sun.position.set(.20, 4.59, -5.02);
  sun.target.position.set(-.42, .6, 1.16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -.00025;
  sun.shadow.normalBias = .018;
  scene.add(sun, sun.target);
  const fill = new THREE.PointLight(palette.lamp, 28, 15, 2);
  fill.position.set(-3.84, 2.7, -2.35);
  scene.add(fill);
}

function release(scene) {
  scene?.traverse((object) => {
    object.geometry?.dispose();
    if (object.material) {
      object.material.map?.dispose();
      object.material.dispose();
    }
    object.shadow?.dispose();
  });
}

export function createWorld({canvas, stage, marker, doorMarker, canMove, onInteract, onFailure, onStep, onPosition, onDoor, onPortal}) {
  const accessible = {
    setChapter() {}, setArea() {}, setTarget() {}, reveal() {},
    guide(callback) { callback(); }, enterSite(_index, callback) { callback(); },
    hold() {}, clearInput() {}, toggleDoor() {}
  };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: "low-power"});
  } catch {
    onFailure();
    return accessible;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  const camera = new THREE.PerspectiveCamera(56, 1, .06, 36);
  camera.rotation.order = "YXZ";
  const keys = new Set();
  let scene, room, markers = [], target, waypoint, drag;
  let focusedDoor;
  let yaw = 0;
  let pitch = .026;
  let previousTime = 0;
  let width = 0;
  let height = 0;
  let contextLost = false;
  let dirty = true;
  let physics;
  let physicsReady = false;

  function setupPhysics() {
    physics?.free();
    physics = physicsReady && room?.floors ? createCharacterPhysics(room) : undefined;
    physics?.sync(camera.position);
    stage.dataset.physics = physics ? "rapier" : "simple";
  }
  initializePhysics().then(() => {
    if (contextLost) return;
    physicsReady = true;
    setupPhysics();
  }).catch((error) => console.warn("Rapier initialization failed:", error));

  canvas.addEventListener("webglcontextlost", () => {
    contextLost = true;
    physics?.free();
    physics = undefined;
    waypoint?.callback();
    waypoint = undefined;
    doorMarker.hidden = true;
    onFailure();
  });

  function size() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    camera.aspect = width / height;
    camera.fov = width / height < 1.04 ? 65 : 55;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    dirty = true;
  }

  function resetView(start, facing, far) {
    camera.position.set(start.x, altitude(start.x), start.z);
    camera.far = far;
    camera.updateProjectionMatrix();
    yaw = facing;
    pitch = -.015;
    keys.clear();
    waypoint = undefined;
    target = undefined;
    focusedDoor = undefined;
    doorMarker.hidden = true;
    dirty = true;
    setupPhysics();
  }

  function arriveAtDoor(door, far) {
    door.setOpen(true, true);
    resetView({x: door.x, z: door.z + 1.24}, Math.PI, far);
  }

  function setChapter(chapter, found = 0, fromDoor = false) {
    if (contextLost) return;
    release(scene);
    const palette = palettes[chapter.scene];
    scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.haze);
    scene.fog = new THREE.FogExp2(palette.haze, .027);
    if (chapter.number === 1) {
      room = dawnChamber(scene, palette, found);
      markers = room.marks;
      const mobileStart = width / Math.max(1, height) < 1.04 && found === 0;
      if (fromDoor) arriveAtDoor(room.exitDoor, 47);
      else resetView(mobileStart ? {...room.start, z: 4.79} : room.start, .037, 47);
    } else {
      room = chamber(scene, chapter.scene, chapter.number, palette);
      room.surface = chapter.scene === "church" ? "stone" : "wood";
      lighting(scene, palette, chapter.scene === "church");
      markers = chapter.beats.map(([,kind,name], index) => displayProp(room, kind, index, name));
      if (fromDoor) arriveAtDoor(room.exitDoor, 36);
      else resetView({x: 0, z: width / Math.max(1, height) < 1.04 ? 4.77 : 3.48}, 0, 36);
    }
  }

  function setArea(area, arrivalSite) {
    if (contextLost) return;
    release(scene);
    scene = new THREE.Scene();
    room = buildDistrict(scene, area, {box, group, cylinder, shape});
    markers = room.markers;
    const door = room.doors[arrivalSite];
    if (door) arriveAtDoor(door, 136);
    else resetView({x: area.spawn[0], z: area.spawn[1]}, 0, 136);
  }

  function setTarget(index) {
    target = markers[index];
    marker.hidden = true;
  }

  function altitude(x) { return (room.eyeHeight ?? eye) + (room.elevation?.(x) ?? 0); }
  function reducedMotion() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function changeDoor(door, opening) {
    const instant = reducedMotion();
    if (!door.setOpen(opening, instant)) return;
    dirty = true;
    onDoor(opening, Math.hypot(camera.position.x - door.x, camera.position.z - door.z));
  }

  function toggleDoor() {
    if (!focusedDoor || !canMove() || waypoint) return false;
    if (!focusedDoor.moving && (!focusedDoor.open || focusedDoor.canClose(camera.position.x, camera.position.z))) {
      changeDoor(focusedDoor, !focusedDoor.open);
    }
    return true;
  }

  function guide(callback) {
    if (!target || contextLost) {
      callback();
      return;
    }
    if (waypoint) return;
    const targetDistance = Math.hypot(camera.position.x - target.x, camera.position.z - target.z);
    if (targetDistance < 1.85) {
      callback();
      return;
    }
    const limits = room.bounds ?? interior;
    const endX = THREE.MathUtils.clamp(target.approach?.x ?? target.x, limits.minX + .55, limits.maxX - .55);
    const endZ = Math.min(target.approach?.z ?? target.z + 1.84 + target.obstacle, limits.maxZ - .39);
    const end = {x: endX, z: endZ};
    const route = room.passage ? room.passage(camera.position, end) : [];
    if (!route) {
      callback();
      return;
    }
    if (reducedMotion()) {
      if (route.length && room.passageDoor) changeDoor(room.passageDoor, true);
      camera.position.set(endX, altitude(endX), endZ);
      physics?.sync(camera.position);
      yaw = Math.atan2(endX - target.x, endZ - target.z);
      dirty = true;
      callback();
      return;
    }
    walk(route, end, {opens: route.length ? room.passageDoor : undefined, face: target, callback});
  }

  function walk(route, end, {opens, face, facing, callback}) {
    const points = [camera.position.clone(), ...[...route, end].map(({x,z}) => new THREE.Vector3(x, altitude(x), z))];
    const hops = points.slice(1).map((point, index) => point.distanceTo(points[index]));
    const distance = hops.reduce((total, length) => total + length, 0);
    waypoint = {
      points, hops, distance,
      startYaw: yaw,
      elapsed: 0,
      duration: THREE.MathUtils.clamp(distance * .145, .34, room.markers ? 2.20 : 1.77),
      opens, face, facing,
      callback
    };
  }

  function enterSite(index, callback) {
    const door = room?.markers && room.doors[index];
    if (!door || contextLost) {
      callback();
      return;
    }
    const end = {x: door.x, z: door.z - doorwayDepth - .27};
    if (reducedMotion()) {
      changeDoor(door, true);
      camera.position.set(end.x, altitude(end.x), end.z);
      yaw = 0;
      dirty = true;
      callback();
      return;
    }
    const route = room.passage(camera.position, end);
    if (!route) {
      callback();
      return;
    }
    walk(route, end, {opens: door, facing: 0, callback});
  }

  function clearInput() { keys.clear(); drag = undefined; }
  function hold(key, down) {
    if (down && canMove()) keys.add(key);
    else keys.delete(key);
  }

  const movement = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
  window.addEventListener("keydown", (event) => {
    if (!canMove() || event.altKey || event.metaKey || event.ctrlKey) return;
    if (movement.has(event.code)) {
      if (!event.repeat) hold(event.code, true);
      event.preventDefault();
    } else if (event.code === "KeyE" && !event.repeat && !toggleDoor()) onInteract();
  });
  window.addEventListener("keyup", (event) => hold(event.code, false));
  window.addEventListener("blur", clearInput);

  canvas.addEventListener("pointerdown", (event) => {
    if (!canMove() || event.button !== 0 || drag) return;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId || !canMove() || waypoint) return;
    yaw -= (event.clientX - drag.x) * .005;
    pitch = THREE.MathUtils.clamp(pitch - (event.clientY - drag.y) * .004, -1.02, .95);
    drag.x = event.clientX;
    drag.y = event.clientY;
    dirty = true;
  });
  canvas.addEventListener("lostpointercapture", (event) => { if (drag?.id === event.pointerId) drag = undefined; });

  function move(delta) {
    if (waypoint) {
      dirty = true;
      if (waypoint.opens) {
        const door = waypoint.opens;
        if (Math.hypot(camera.position.x - door.x, camera.position.z - door.z) < 2.30) {
          changeDoor(door, true);
          if (door.moving) return;
          waypoint.opens = undefined;
        }
      }
      waypoint.elapsed += delta;
      const fraction = Math.min(1, waypoint.elapsed / waypoint.duration);
      const eased = fraction * fraction * (3 - 2 * fraction);
      let traveled = eased * waypoint.distance;
      let hop = 0;
      while (hop < waypoint.hops.length - 1 && traveled > waypoint.hops[hop]) traveled -= waypoint.hops[hop++];
      const [from,to] = [waypoint.points[hop], waypoint.points[hop + 1]];
      const part = Math.min(1, traveled / Math.max(.001, waypoint.hops[hop]));
      camera.position.lerpVectors(from, to, part);
      camera.position.y = altitude(camera.position.x);
      let facing = Math.atan2(from.x - to.x, from.z - to.z);
      if (hop === waypoint.hops.length - 1) {
        if (waypoint.facing !== undefined) facing = waypoint.facing;
        else if (waypoint.face) facing = Math.atan2(to.x - waypoint.face.x, to.z - waypoint.face.z);
      }
      const difference = Math.atan2(Math.sin(facing - waypoint.startYaw), Math.cos(facing - waypoint.startYaw));
      yaw = waypoint.startYaw + difference * Math.min(1, fraction * 2.5);
      pitch *= (1 - eased * .2);
      if (fraction === 1) {
        physics?.sync(camera.position);
        const callback = waypoint.callback;
        waypoint = undefined;
        callback();
      }
      return;
    }
    const turn = Number(keys.has("ArrowLeft")) - Number(keys.has("ArrowRight"));
    if (turn) {
      yaw += turn * delta * 1.80;
      dirty = true;
    }
    const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const strafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    if (!forward && !strafe && !physics) return;
    const speed = (room.markers ? 4.3 : 2.6) * delta / (Math.hypot(forward, strafe) || 1);
    const {x, z} = camera.position;
    const limits = room.bounds ?? interior;
    const nextX = THREE.MathUtils.clamp(x + (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * speed, limits.minX, limits.maxX);
    const nextZ = THREE.MathUtils.clamp(z + (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * speed, limits.minZ, limits.maxZ);
    if (physics) {
      if (physics.move(camera.position, nextX - x, nextZ - z, delta)) dirty = true;
      return;
    }
    dirty = true;
    const pass = (px, pz) => !room.obstacles.some((o) => Math.abs(px - o.x) < o.w / 2 + .18 && Math.abs(pz - o.z) < o.d / 2 + .18)
      && !room.doors?.some((door) => door.blocks(px, pz));
    if (pass(nextX, z)) camera.position.x = nextX;
    if (pass(camera.position.x, nextZ)) camera.position.z = nextZ;
    camera.position.y = altitude(camera.position.x);
  }

  function screenPoint(point) {
    look.set(point.x, point.marker, point.z).sub(camera.position);
    camera.getWorldDirection(projected);
    if (look.dot(projected) <= 0) return;
    projected.set(point.x, point.marker, point.z).project(camera);
    if (Math.abs(projected.x) > .82 || projected.y > .76 || projected.y < -.55) return;
    return {x: projected.x, y: projected.y};
  }

  function placeMarker(element, point) {
    element.hidden = !point;
    if (point) {
      element.style.left = (50 + point.x * 50) + "%";
      element.style.top = (50 - point.y * 50) + "%";
    }
  }

  function projectMarkers() {
    focusedDoor = undefined;
    let closest = 3.10;
    let doorPoint;
    const enabled = canMove() && !waypoint;
    if (enabled) {
      for (const door of room.doors ?? []) {
        const distance = Math.hypot(camera.position.x - door.x, camera.position.z - door.z);
        if (distance >= closest) continue;
        const markerHeight = THREE.MathUtils.lerp(camera.position.y, door.marker, THREE.MathUtils.smoothstep(distance, .42, 1.45));
        const point = screenPoint({x: door.x, z: door.z, marker: markerHeight});
        if (point) {
          closest = distance;
          focusedDoor = door;
          doorPoint = point;
        }
      }
    }
    placeMarker(doorMarker, doorPoint);
    if (focusedDoor) {
      const waiting = focusedDoor.open && !focusedDoor.moving && !focusedDoor.canClose(camera.position.x, camera.position.z);
      const action = focusedDoor.open
        ? (focusedDoor.moving ? "正在开门" : waiting ? "退开再关门" : "关门")
        : (focusedDoor.moving ? "正在关门" : "开门");
      if (doorMarker.dataset.action !== action) {
        doorMarker.dataset.action = action;
        doorMarker.setAttribute("aria-label", action);
      }
      doorMarker.disabled = focusedDoor.moving || waiting;
    }
    const point = target && room.entrance && ((target.x < room.entrance.x) !== (camera.position.x < room.entrance.x))
      ? room.entrance : target;
    const sameSpot = focusedDoor && point && Math.hypot(focusedDoor.x - point.x, focusedDoor.z - point.z) < .9;
    placeMarker(marker, enabled && point && !sameSpot ? screenPoint(point) : undefined);
  }

  function crossedDoor(door, beforeX, beforeZ) {
    if (!door.open) return false;
    const threshold = door.z - doorwayDepth;
    const afterZ = camera.position.z;
    if (beforeZ < threshold || afterZ >= threshold) return false;
    const fraction = (beforeZ - threshold) / (beforeZ - afterZ);
    const crossingX = THREE.MathUtils.lerp(beforeX, camera.position.x, fraction);
    return Math.abs(crossingX - door.x) < door.width / 2;
  }

  function checkPortal(beforeX, beforeZ) {
    if (room.markers) {
      const index = room.doors.findIndex((door) => crossedDoor(door, beforeX, beforeZ));
      if (index >= 0) onPortal(index);
    } else if (room.exitDoor && crossedDoor(room.exitDoor, beforeX, beforeZ)) onPortal();
  }

  function frame(time) {
    requestAnimationFrame(frame);
    const delta = Math.min(.05, (time - previousTime) / 1000);
    previousTime = time;
    if (!scene || contextLost || !stage.clientWidth) return;
    size();
    if (canMove()) {
      const walking = !waypoint;
      const beforeX = camera.position.x;
      const beforeZ = camera.position.z;
      move(delta);
      const distance = Math.hypot(camera.position.x - beforeX, camera.position.z - beforeZ);
      if (distance > .002 && canMove()) {
        onStep(room.surface ?? "wood", distance);
        if (walking) checkPortal(beforeX, beforeZ);
      }
    }
    if (room.tick?.(delta)) dirty = true;
    for (const door of room.doors ?? []) if (door.tick(delta)) dirty = true;
    if (dirty) {
      camera.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
      dirty = false;
      onPosition(camera.position);
    }
    projectMarkers();
  }

  size();
  requestAnimationFrame(frame);
  return {setChapter, setArea, setTarget, guide, enterSite, hold, clearInput, toggleDoor, reveal(index) { room?.reveal?.(index); }};
}
