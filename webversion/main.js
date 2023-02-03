/**
 * Adds a  draggable marker to the map..
 *
 * @param {H.Map} map                      A HERE Map instance within the
 *                                         application
 * @param {H.mapevents.Behavior} behavior  Behavior implements
 *                                         default interactions for pan/zoom
 */



//initial setup
let r_e=6731; //Earth Radius in Kilometers
let imgSize=256; //pixelsize of image
let plotLim=15000; //max plot length of baselines
let n_iter=48; //number of iterations for fourier transform
let cc = 9e-6 //contrast constant
let n_iter_times=15; //n_iter*n_iter_times samples of the uv coverage will be calculated, has to be smaller than n_iter
const full_spin_time=40000; //time in milli-seconds for one full spin in play mode


function Pol2Cart(r,phi,delta){
let x = r*Math.cos(delta/180*Math.PI)*Math.cos(phi/180*Math.PI);
let y = -r*Math.cos(delta/180*Math.PI)*Math.sin(phi/180*Math.PI);
let z = r*Math.sin(delta/180*Math.PI);

return [x,y,z];
}

//used to save grey scale values of true image fourier transform
var h_ft_image=[];

//Globe Telescope Locations
let locations = [];

var declination = 0;

let source = [0,0];

let first_i=0;

let last_i=0;  

  
let u_v_grids=[];
let images=[];

var elev_lim=0;

let tel_visibles=[];

//progress bar
var progress_bar = document.getElementById("myBar");

//update plots according to telescopes and selected time
function updateUVtracks(){


  images=[];

  //update source declination
  source = [200, declination];
  elev_lim=parseInt(elev_lim_control.value); //elevetion limit for telescopes in degree

  //calculate u-v transformation matrix from source coordinates
  let H_var=source[0]/180*Math.PI;
  let delta=source[1]/180*Math.PI;

  let matrix=[[Math.sin(H_var),Math.cos(H_var),0],
        [-Math.sin(delta)*Math.cos(H_var),Math.sin(delta)*Math.sin(H_var),Math.cos(delta)],
        [Math.cos(delta)*Math.cos(H_var),-Math.cos(delta)*Math.sin(H_var),Math.sin(delta)]];

  let source_vector=Pol2Cart(r_e,source[0],source[1]);

  function getUV(Tel1,Tel2,matrix){
    let baseline=[Tel2[0]-Tel1[0],Tel2[1]-Tel1[1],Tel2[2]-Tel1[2]];
    return [matrix[0][0]*baseline[0]+matrix[0][1]*baseline[1]+matrix[0][2]*baseline[2],
            matrix[1][0]*baseline[0]+matrix[1][1]*baseline[1]+matrix[1][2]*baseline[2],
            matrix[2][0]*baseline[0]+matrix[2][1]*baseline[2]+matrix[2][2]*baseline[2]];
  }

	//calculate number of baselines
	let n_baselines=Math.round(count_telescopes*(count_telescopes-1)/2);

	let pixelSize=plotLim*2/imgSize;

	//create array to save uv_tracks for every baseline
	let u_v_tracks=[];
  
  let u_v_grid=Array(imgSize).fill().map(() => Array(imgSize).fill(0)); //create uv_coverage image
  
  let image=[]; //create image
  
	let u_v_track=Array(n_baselines).fill().map(() => Array(2).fill([]));

  let first=true;

  first_i=0;
  last_i=0;

  tel_visibles=[];

  //start with empty image first
  u_v_tracks.push(JSON.parse(JSON.stringify(u_v_track)));
  u_v_grids.push(JSON.parse(JSON.stringify(u_v_grid)));

  
  for (let i = 0; i < n_iter*n_iter_times; i++) {

    let t=360/n_iter/n_iter_times*i;

    
    //convert all telescope positions to cartesian coordinates
    let tels=[];
    let tel_visible=[]; //array to store boolean information whether telescope can see the source or not
    //for loop to set tels and tel_visible values
    for (let j=0; j<telescopes.length;j++){
       	let new_lng=telescopes[j].getGeometry().lng+t;
        if(new_lng>180){
            new_lng=new_lng-360;
        }
        let tel=Pol2Cart(r_e,new_lng,telescopes[j].getGeometry().lat);
        tels[j]=tel;

          //determine whether source is visible to telescope
          let dot_prod=tel[0]*source_vector[0]+tel[1]*source_vector[1]+tel[2]*source_vector[2];
          if (dot_prod/Math.pow(r_e,2)<Math.cos((90-elev_lim)/180*Math.PI)){
              tel_visible[j]=false;
          }else{
              tel_visible[j]=true;
          }       
     }

     tel_visibles.push(tel_visible);
    
     
      let baseline_count=0
      for (let m=0; m<tels.length;m++){
          if (m<(tels.length-1)){
              for (let l=m+1;l<tels.length;l++){
                  if(tel_visible[m] && tel_visible[l]){				

                      if (first){
                        first=false;
                        first_i=i.toString();
                      };

                      //get new u_v data point
                      var baseline_uv=getUV(tels[m],tels[l],matrix);
                      var u=baseline_uv[0];
                      var v=baseline_uv[1];

                      //append new u_v point to baseline u_v track
                      //u_v_track[baseline_count][0].push(u);
                      //u_v_track[baseline_count][1].push(v);

                      //change u_v_sampling grid
                      var x_ind=Math.floor((u+plotLim)/pixelSize);
                      var y_ind=Math.floor((v+plotLim)/pixelSize);

                      u_v_grid[y_ind][x_ind]=1;

                      var x_ind=Math.floor((-u+plotLim)/pixelSize);
                      var y_ind=Math.floor((-v+plotLim)/pixelSize);

                      u_v_grid[y_ind][x_ind]=1;

                      last_i=i;
									}
                  baseline_count+=1;
               }
            }
      }
      u_v_tracks[i]=JSON.parse(JSON.stringify(u_v_track)); //JSON parse part save array in current status so it doesnt get overwritten
      u_v_grids[i]=JSON.parse(JSON.stringify(u_v_grid));
      }

  DrawUVCanvas(u_v_grid,ctx_uv,canvas_uv);
  DrawUVCanvas(u_v_grid,ctx_uv_map,canvas_uv_map)

  //compute FT transforms
  for (let aidx=parseInt(first_i);aidx<=last_i; aidx=aidx+n_iter_times){
      setTimeout(function(){
        progress_bar.style.width=Math.round((aidx-first_i)/(last_i-first_i)*100) + "%";
        DrawFourierCanvas(u_v_grids[aidx]);
        if (aidx>=last_i-n_iter_times+1){
          setTimeout(function(){
            loading_screen.style.display = 'none';
            map_modal.style.display = "none";
            progress_bar.style.width = "0%";
            ctx_image.putImageData(images[getFourierIndex(last_i-parseInt(first_i))], 0, 0);
            ctx_image_map.putImageData(images[getFourierIndex(last_i-parseInt(first_i))], 0, 0);
          },1000);
        }
      },(aidx-first_i)*10);
  };

  

  //set time control element from start to end of observation
  time_control.min=first_i;
  time_control.max=last_i.toString();
  time_control.value=last_i.toString();
  time_control.style.display = '';
  play_button.style.display = '';

  //Draw 3D globe
  locations = [];
  for (j=0;j<telescopes.length;j++){
    locations.push({"latitude": telescopes[j].getGeometry().lat, "longitude": telescopes[j].getGeometry().lng})
  } 


  //update Globe plot
  removeAllMarkers();
  addMarkers();
  updateCamera(delta);

  RotateGlobe((source[0]+360/n_iter/n_iter_times*last_i-135)/180.0*Math.PI,last_i);
 
 }

function getFourierIndex(n){
  return Math.floor(n/n_iter_times);
}


function DrawFourierCanvas(u_v_grid){

  var h_primes = [];
  var h_hats = $h2();
  var h_hats_new=[];
  var indx=0;
  for (let ai=0; ai < imgSize; ai++){
    for (let ak=0; ak < imgSize; ak++){
      if(u_v_grid[ak][ai]==1){
        h_hats_new.push(h_hats[indx].times(1));
      } else {
        h_hats_new.push(h_hats[indx].times(0));
      }
      indx++;
    };    
  };
  h_hats = h_hats_new;

  h_hats = Fourier.unshift(h_hats, [imgSize,imgSize]);
  Fourier.invert(h_hats, h_primes);

  // get the largest magnitude
  var maxMagnitude = 0;
  for (let aj = 0; aj < h_primes.length; aj++) {
    var mag = h_primes[aj];
    if (mag > maxMagnitude) {
      maxMagnitude = mag;
    };
  };

  // store them in a nice function to match the math
  h_ = function(n, m) {
    if (arguments.length === 0) return h_primes;

    var idx = n*imgSize + m;
    return h_primes[idx];
  };

  // clear the canvas
  ctx_image.clearRect(0,0,canvas_img.width,canvas_img.height);

  // draw the pixels
  var currImageData = ctx_image.getImageData(
    0, 0, imgSize, imgSize
  );
  var logOfMaxMag = Math.log(cc*maxMagnitude+1);
  for (let k = 0; k < imgSize; k++) {
    for (let l = 0; l < imgSize; l++) {
      var idxInPixels = 4*(imgSize*k + l);
      currImageData.data[idxInPixels+3] = 255; // full alpha
      var color = Math.log(cc*h_(k, l)+1);
      color = Math.round(255*(color/logOfMaxMag));
      // RGB are the same -> gray
      for (let c = 0; c < 3; c++) { // lol c++
        currImageData.data[idxInPixels+c] = color;
      }
    }
  }
  
  images.push(currImageData);

}


function round(n, places) {
  var mult = Math.pow(10, places);
  return Math.round(mult*n)/mult;
}


function DrawUVCanvas(img_data,ctx_uv,canvas_uv){

// clear the canvas
ctx_uv.clearRect(0,0,canvas_uv.width,canvas_uv.height);

for (y=0; y < img_data.length; y++){
  for (x=0; x < img_data[0].length; x++){
    ctx_uv.fillStyle=["black","white"][img_data[y][x]];
    ctx_uv.fillRect(x,y,1,1)
  };
};

}


function addDraggableMarker(map, behavior, latitude, longitude){

  var icon = new H.map.Icon('img/Teleskop.svg',{ size: { w: 56, h: 56 }});

  var marker = new H.map.Marker({lat:latitude, lng:longitude}, {
    // mark the object as volatile for the smooth dragging
    volatility: true,
    icon: icon
  });
  // Ensure that the marker can receive drag events
  marker.draggable = true;
  map.addObject(marker);

  // disable the default draggability of the underlying map
  // and calculate the offset between mouse and target's position
  // when starting to drag a marker object:
  map.addEventListener('dragstart', function(ev) {
    var target = ev.target,
        pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
      var targetPosition = map.geoToScreen(target.getGeometry());
      target['offset'] = new H.math.Point(pointer.viewportX - targetPosition.x, pointer.viewportY - targetPosition.y);
      behavior.disable();
    }
  }, false);


  // re-enable the default draggability of the underlying map
  // when dragging has completed
  map.addEventListener('dragend', function(ev) {
  	//when dragging is complete update uv coverage and other plots
    var target = ev.target;
    if (target instanceof H.map.Marker) {
      behavior.enable();
    }
  }, false);

  // Listen to the drag event and move the position of the marker
  // as necessary
   map.addEventListener('drag', function(ev) {
    var target = ev.target,
        pointer = ev.currentPointer;
    if (target instanceof H.map.Marker) {
      target.setGeometry(map.screenToGeo(pointer.viewportX - target['offset'].x, pointer.viewportY - target['offset'].y));
    }
  }, false);
  
return marker;
}



/**
 * Boilerplate map initialization code starts below:
 */
var defaultLayers = platform.createDefaultLayers();

//Step 2: initialize a map
var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map, {
  center: {lat:50.35805, lng:10.0636},
  zoom: 3,
  pixelRatio: window.devicePixelRatio || 1
});
// add a resize listener to make sure that the map occupies the whole container
window.addEventListener('resize', () => map.getViewPort().resize());

//Step 3: make the map interactive
// MapEvents enables the event system
// Behavior implements default interactions for pan/zoom (also on mobile touch environments)
var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

// Step 4: Create the default UI:
var ui = H.ui.UI.createDefault(map, defaultLayers, 'en-US');

var telescopes = [];
var count_telescopes= 0;

//add event listener to Add Telescope button
var add_tel_button = document.getElementById("add_tel_button");
add_tel_button.addEventListener('click', function() { 
	var marker_new=addDraggableMarker(map,behavior,map.getCenter().lat,map.getCenter().lng);
  telescopes[count_telescopes]=marker_new;
  count_telescopes++;
  }, false);

//add event listener to Measure button
var measure_button = document.getElementById("measure_button");
measure_button.addEventListener('click', function() { 
  if (telescopes.length<2){
    alert("Please select at least 2 telescopes!");
  }else{
    //turn on loading screen
    loading_screen.style.display = 'block';
    setTimeout(function(){
      updateUVtracks();
      //turn off loading screen
    }, 200);
  }
}, false);

//add event listener to Play button
var play=false;
var play_button = document.getElementById("play_button");
play_button.addEventListener('click', function() { 
  if(play){
    clearInterval(playLoop);
    play_button.src="img/play_button.svg";
    play=false;
  } else {
    play=true;
    this.src = "img/Basic_red_dot.png";
    playLoop=setInterval(function(){
        time_control.value++;
        time_control.dispatchEvent(new Event('input'));
        if (time_control.value==time_control.max){
          time_control.value=time_control.min;
        }    
    },full_spin_time/n_iter/n_iter_times);
  }
}, false);
play_button.style.display = 'none';


var time_count = document.getElementById("time_count");

var time_control = document.getElementById("time_control");
time_control.addEventListener('input', function () {
  var indx = Math.round(time_control.value);
	DrawUVCanvas(u_v_grids[indx],ctx_uv,canvas_uv);
  ctx_image.putImageData(images[getFourierIndex(indx-parseInt(first_i))], 0, 0);
  RotateGlobe((source[0]+360/n_iter/n_iter_times*indx-135)/180.0*Math.PI,indx);
  //determine time count:
  decimal_hours=(indx-parseInt(first_i))/(n_iter*n_iter_times-1)*24;
  hours=Math.floor(((indx-parseInt(first_i))/(n_iter*n_iter_times-1)*24));
  minutes=Math.round((decimal_hours-hours)*60);
  time_count.innerText="Beobachtungszeit " + hours.toString().padStart(2, '0')+":"+minutes.toString().padStart(2, '0')+" h";
  }, false);
time_control.step=0.0001;
time_control.style.display = 'none';


var elev_lim_control = document.getElementById("elev_lim_control");

//image for main page
var canvas_img=document.getElementById("canvas_image");
canvas_img.width=imgSize;
canvas_img.height=imgSize;
var ctx_image=canvas_img.getContext('2d');
//initialize canvas as black box
ctx_image.fillRect(0, 0, imgSize, imgSize);


//image for map page
var canvas_img_map=document.getElementById("canvas_image_map");
canvas_img_map.width=imgSize;
canvas_img_map.height=imgSize;
var ctx_image_map=canvas_img_map.getContext('2d');
ctx_image_map.fillRect(0, 0, imgSize, imgSize);

//uv plot for main page
var canvas_uv=document.getElementById("canvas_uv");
canvas_uv.width=imgSize;
canvas_uv.height=imgSize;
var ctx_uv=canvas_uv.getContext('2d');
ctx_uv.fillRect(0, 0, imgSize, imgSize);

//uv plot for map page
var canvas_uv_map=document.getElementById("canvas_uv_map");
canvas_uv_map.width=imgSize;
canvas_uv_map.height=imgSize;
var ctx_uv_map=canvas_uv_map.getContext('2d');
ctx_uv_map.fillRect(0, 0, imgSize, imgSize);

//real image plot
var canvas_real_image=document.getElementById("canvas_real_image");
canvas_real_image.width=imgSize;
canvas_real_image.height=imgSize;
var ctx_real_image=canvas_real_image.getContext("2d");

const new_img = new Image();
//image selector
var image_select = document.getElementById("image_select");
image_select.addEventListener("click",function(){
  ctx_real_image.fillRect(0,0,imgSize,imgSize);
  ctx_real_image.font = "40px Arial";
  ctx_real_image.fillStyle = "#ffffff";
  ctx_real_image.fillText("Lädt...", imgSize/2-50, imgSize/2+15);
  ctx_real_image.fillStyle = "#000000"; 
  new_img.src=image_select.value;
  new_img.addEventListener(
  "load",
  () => {
    ctx_real_image.drawImage(new_img,0,0,imgSize,imgSize);
    var imageData = ctx_real_image.getImageData(0, 0, imgSize, imgSize);
    DrawFourierImage(imageData);

  },false)
},false);

//set default image
image_select.dispatchEvent(new Event('click'));


//image loader
var image = document.getElementById('image');
if (image) {
  image.addEventListener('change', function () {
  if (this.files && this.files[0]) {
    var fr = new FileReader();
    fr.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
    ctx_real_image.drawImage(img, 0, 0, imgSize, imgSize);
    var imageData = ctx_real_image.getImageData(0, 0, imgSize, imgSize);
    DrawFourierImage(imageData);
    };
    img.src = ev.target.result;
    };
    fr.readAsDataURL(this.files[0]);
  }

}, false);}

function DrawFourierImage(imageData){
//calculate Fourier Transform of image

    var h_image=[];
    for (var ai = 0; ai < imageData.data.length; ai+=4) {
      // greyscale, so you only need every 4th value
      h_image.push(imageData.data[ai]);
    }

    h2=function(n,m){
      if (arguments.length ===0) return h_image;
      return h_image[idx];
    };


    var h2_hats = [];
    Fourier.transform(h2(), h2_hats);
    h2_hats = Fourier.shift(h2_hats, [imgSize,imgSize]);

    // get the largest magnitude
    var maxMagnitude = 0;
    for (var ai = 0; ai < h2_hats.length; ai++) {
      var mag = h2_hats[ai].magnitude();
      if (mag > maxMagnitude) {
        maxMagnitude = mag;
      };
    };

    // store them in a nice function to match the math
    $h2 = function(k, l) {
      if (arguments.length === 0) return h2_hats;
      var idx = k*imgSize + l;
      return h2_hats[idx];
    };


    ctx_real_image.putImageData(imageData, 0, 0);


}


var loading_screen = document.getElementById("cover-spin");


// pre-defined telescope arrays

//function to add list of telescopes

var preset_locations = [];
var checkboxes = [];

function addTelescopesToMap(tel_locations){
  for (i=0;i<tel_locations.length;i++){
    var marker_new=addDraggableMarker(map,behavior,tel_locations[i][0],tel_locations[i][1]);
    telescopes[count_telescopes]=marker_new;
    count_telescopes++;
  };
}

function removeAllTelescopesFromMap(){
  for (let i=0;i<checkboxes.length;i++){
    if (checkboxes[i].box.checked){
      checkboxes[i].box.click();
    }
  }
  for (let i=0;i<telescopes.length;i++){
    removeTelescopesFromMap([[telescopes[i].getGeometry().lat,telescopes[i].getGeometry().lng]]);
  }
}

function removeTelescopesFromMap(tel_locations){
  if (tel_locations.length>0){
    for (i=0;i<tel_locations.length;i++){    

      function checkTel(telescope) {
        return telescope.getGeometry().lat==tel_locations[i][0] && telescope.getGeometry().lng==tel_locations[i][1];
      };

      const index = telescopes.findIndex(checkTel);

      if (index > -1) {
        map.removeObject(telescopes[index]);
        telescopes.splice(index, 1);
        count_telescopes--;
      }
    };
  };
}

function changeCheckboxAction(){
  removeTelescopesFromMap(preset_locations);

  preset_locations=[];

  for(let ai=0;ai<checkboxes.length;ai++){
    if(checkboxes[ai].box.checked){
      for(let ak=0;ak<checkboxes[ai].locations.length;ak++){
        //append all Telescopes, but only once
        function checkTel(telescope) {
          return telescope[0]==checkboxes[ai].locations[ak][0] && telescope[1]==checkboxes[ai].locations[ak][1];
        };
        const index = preset_locations.findIndex(checkTel);
        if (index == -1) {
          preset_locations.push(checkboxes[ai].locations[ak]);
        };
      };
    };
  };
  addTelescopesToMap(preset_locations);
}

var vlba = document.getElementById('vlba');

var vlba_locations=[[42.93362, -71.98681],[41.77165, -91.574133],[30.635214, -103.944826],
      [35.775289, -106.24559],[34.30107, -108.11912],[31.956253, -111.612361],
      [37.23176, -118.27714],[48.13117, -119.68325],[19.80159, -155.45581],[17.75652, -64.58376]];

checkboxes.push({"box": vlba, "locations": vlba_locations});

vlba.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2017 = document.getElementById('eht2017');

var eht2017_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056]];
checkboxes.push({"box": eht2017, "locations": eht2017_locations});

eht2017.addEventListener('change', function() {
  changeCheckboxAction();
});

var eht2018 = document.getElementById('eht2018');

var eht2018_locations=[[32.701547,-109.891269],[-23.005893,-67.759155],[37.066162,-3.392918],[19.822485,-155.476718],
      [18.985439,-97.314765],[19.8237546,-155.477420],[-23.024135,-67.754230],[-89.99,-63.453056],[76.531203,-68.703161],[44.63389,5.90792],[31.9533,-111.615]];
checkboxes.push({"box": eht2018, "locations": eht2018_locations});

eht2018.addEventListener('change', function() {
  changeCheckboxAction();
});

var tanami = document.getElementById('tanami');

var tanami_locations=[[-30.31,149.57],[-31.30,149.07],[-33.00,148.26],[-42.80,147.44],[-31.87,133.81],[-25.89,27.67],[-14.38,132.15],[-29.05,115,35],[-36.43,174.66]];
checkboxes.push({"box": tanami, "locations": tanami_locations});

tanami.addEventListener('change', function() {
  changeCheckboxAction();
});

changeCheckboxAction();


//map modal
var map_modal = document.getElementById("map-modal");
var map_modal_btn = document.getElementById("map-modal-button");
var map_modal_span = document.getElementById("close-map-modal");
map_modal.style.display="none";
map_modal_btn.onclick = function() {
  map_modal.style.display = "block";
  //stop play button
  if(play){
    play_button.dispatchEvent(new Event('click'));
  }
}
map_modal_span.onclick = function() {map_modal.style.display = "none";}

//info modal for map
var info_modal1 = document.getElementById("info-modal-1");
var info_modal_btn1 = document.getElementById("info-modal-button-1");
var info_modal_span1 = document.getElementById("close-info-modal-1");
info_modal_btn1.onclick = function() {info_modal1.style.display = "block";}
info_modal_span1.onclick = function() {info_modal1.style.display = "none";}

//info modal for uv coverage
var info_modal2 = document.getElementById("info-modal-2");
var info_modal_btn2 = document.getElementById("info-modal-button-2");
var info_modal_span2 = document.getElementById("close-info-modal-2");
info_modal_btn2.onclick = function() {info_modal2.style.display = "block";}
info_modal_span2.onclick = function() {info_modal2.style.display = "none";}

//info modal for image
var info_modal3 = document.getElementById("info-modal-3");
var info_modal_btn3 = document.getElementById("info-modal-button-3");
var info_modal_span3 = document.getElementById("close-info-modal-3");
info_modal_btn3.onclick = function() {info_modal3.style.display = "block";}
info_modal_span3.onclick = function() {info_modal3.style.display = "none";}


var reset_button = document.getElementById("reset_button");
reset_button.addEventListener('click', function() { 
  removeAllTelescopesFromMap();
}, false);

//Declination Range Slider JS
// vanilla JavaScript
var input = document.querySelector('.plain-angle-input');

var angle = AngleInput(input);
  
input.oninput = function(e) {
  declination=angle()-90;
}

input.onchange = function(e) {
  declination=angle()-90;
}

//size globe
onWindowResize();




